import json
from base64 import b64decode
from pathlib import Path
from urllib.parse import quote_plus

import pytest
import trimesh
from botocore.exceptions import ClientError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from moto import mock_aws

from marrow.main import app
from marrow.routes.upload_events import router as events_router
from marrow.settings import get_settings
from marrow.specimens.store import get_specimen_store
from marrow.specimens.upload_bucket import UploadBucket, _bucket


@pytest.fixture
def s3(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("UPLOAD_BUCKET", "marrow-upload-test")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("ASSETS_DIR", str(tmp_path / "no-image-writes"))
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
    _bucket.cache_clear()
    try:
        with mock_aws():
            api = UploadBucket("marrow-upload-test")
            api.client.create_bucket(Bucket=api.name)
            yield api
    finally:
        _bucket.cache_clear()
        get_settings.cache_clear()
        get_specimen_store.cache_clear()


@pytest.mark.parametrize("filename", ["my specimen.stl", "my specimen.ply"])
def test_remote_upload_is_visible_on_a_fresh_instance(
    s3: UploadBucket,
    filename: str,
):
    data = trimesh.creation.box().export(file_type=Path(filename).suffix[1:])
    api = TestClient(app)
    upload = api.post("/uploads/init", json={"filename": filename, "size": len(data)})
    assert upload.is_success, upload.text
    form = upload.json()
    policy = json.loads(b64decode(form["fields"]["policy"]))
    assert ["content-length-range", len(data), len(data)] in policy["conditions"]
    key = form["fields"]["key"]
    obj = s3.client.put_object(Bucket=s3.name, Key=key, Body=data)
    job_id = form["id"]
    assert api.get(f"/uploads/{job_id}").json()["status"] == "processing"
    assert api.get("/specimens").json() == []
    worker = UploadBucket(s3.name)
    etag = obj["ETag"].strip('"')
    worker.process(key, etag)
    worker.process(key, etag)  # at-least-once delivery
    assert (
        s3.client.list_objects_v2(Bucket=s3.name, Prefix="incoming/")["KeyCount"] == 0
    )
    assert not get_specimen_store().assets_dir.exists()
    get_specimen_store.cache_clear()
    _bucket.cache_clear()
    assert api.get(f"/uploads/{job_id}").json()["status"] == "ready"
    assert [row["id"] for row in api.get("/specimens").json()] == [job_id]
    mesh = api.get(f"/specimens/{job_id}").json()["structures"][0]
    assert mesh["sourceFilename"] == filename
    assert mesh["triangleCount"] == 12
    redir = api.get(mesh["meshUrl"], follow_redirects=False)
    assert redir.status_code == 307
    assert redir.headers["cache-control"] == "no-store"
    assert f"/meshes/{job_id}/" in redir.headers["location"]
    manifest = s3.manifest(job_id)
    assert manifest is not None
    glb = s3.client.get_object(Bucket=s3.name, Key=manifest["meshKey"])
    assert glb["Body"].read(4) == b"glTF"


def test_corrupt_remote_mesh_drops_source_and_retains_failure(s3: UploadBucket):
    form = s3.initiate("broken.stl", 5)
    key = form["fields"]["key"]
    obj = s3.client.put_object(Bucket=s3.name, Key=key, Body=b"wrong")
    etag = obj["ETag"].strip('"')
    UploadBucket(s3.name).process(key, etag)
    UploadBucket(s3.name).process(key, etag)
    assert s3.status(form["id"])["status"] == "failed"
    assert s3.catalog() == []
    assert (
        s3.client.list_objects_v2(Bucket=s3.name, Prefix="incoming/")["KeyCount"] == 0
    )


def test_worker_accepts_adapter_event_without_content_type(s3: UploadBucket):
    data = trimesh.creation.box().export(file_type="ply")
    form = s3.initiate("my specimen.ply", len(data))
    key = form["fields"]["key"]
    obj = s3.client.put_object(Bucket=s3.name, Key=key, Body=data)
    worker = FastAPI()
    worker.include_router(events_router)
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": s3.name},
                    "object": {"key": quote_plus(key), "eTag": obj["ETag"].strip('"')},
                }
            }
        ]
    }
    client = TestClient(worker)
    assert client.post("/events", content=json.dumps(event)).is_success
    assert s3.status(form["id"])["status"] == "ready"
    assert TestClient(app).post("/events", json=event).status_code == 404


@pytest.mark.parametrize("phase", ["publication", "cleanup"])
def test_transient_storage_failure_can_be_retried(
    s3: UploadBucket,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
):
    data = trimesh.creation.box().export(file_type="stl")
    form = s3.initiate("scan.stl", len(data))
    key = form["fields"]["key"]
    obj = s3.client.put_object(Bucket=s3.name, Key=key, Body=data)
    etag = obj["ETag"].strip('"')
    operation = "put_object" if phase == "publication" else "delete_object"
    original = getattr(s3.client, operation)

    def fail_once(**kwargs):
        if phase == "cleanup" or kwargs["Key"].startswith("manifests/"):
            monkeypatch.setattr(s3.client, operation, original)
            raise ClientError({"Error": {"Code": "SlowDown"}}, operation)
        return original(**kwargs)

    monkeypatch.setattr(s3.client, operation, fail_once)
    with pytest.raises(ClientError):
        s3.process(key, etag)
    assert s3.client.head_object(Bucket=s3.name, Key=key)["ContentLength"] == len(data)
    assert s3.status(form["id"])["status"] == (
        "processing" if phase == "publication" else "ready"
    )
    s3.process(key, etag)
    assert s3.status(form["id"])["status"] == "ready"
    assert not s3.client.list_objects_v2(Bucket=s3.name, Prefix="incoming/")["KeyCount"]
    assert s3.client.list_objects_v2(Bucket=s3.name, Prefix="meshes/")["KeyCount"] == 1


def test_competing_post_cannot_replace_published_mesh_or_leave_unused_glb(
    s3: UploadBucket,
    monkeypatch: pytest.MonkeyPatch,
):
    mesh = trimesh.creation.box()
    data = mesh.export(file_type="stl")
    form = s3.initiate("scan.stl", len(data))
    key = form["fields"]["key"]
    first = s3.client.put_object(Bucket=s3.name, Key=key, Body=data)
    put_object = s3.client.put_object
    winner = {}

    def publish_competing_mesh(**kwargs):
        if kwargs["Key"].startswith("manifests/"):
            monkeypatch.setattr(s3.client, "put_object", put_object)
            mesh.apply_translation([5, 0, 0])
            second = put_object(
                Bucket=s3.name,
                Key=key,
                Body=mesh.export(file_type="stl"),
            )
            etag = second["ETag"].strip('"')
            UploadBucket(s3.name).process(key, etag)
            winner["key"] = f"meshes/{form['id']}/{etag}.glb"
        return put_object(**kwargs)

    monkeypatch.setattr(s3.client, "put_object", publish_competing_mesh)
    s3.process(key, first["ETag"].strip('"'))
    manifest = s3.manifest(form["id"])
    assert manifest is not None and manifest["meshKey"] == winner["key"]
    objects = s3.client.list_objects_v2(Bucket=s3.name, Prefix="meshes/")["Contents"]
    assert [item["Key"] for item in objects] == [winner["key"]]
    assert not s3.client.list_objects_v2(Bucket=s3.name, Prefix="incoming/")["KeyCount"]
