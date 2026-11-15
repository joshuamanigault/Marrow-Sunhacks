from pathlib import Path

import pytest
import trimesh
from fastapi.testclient import TestClient

from marrow.main import app
from marrow.routes import uploads
from marrow.routes.ai import _grounded_specimen
from marrow.settings import get_settings
from marrow.specimens.store import get_specimen_store


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ASSETS_DIR", str(tmp_path / "assets"))
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("extension", ["stl", "ply"])
def test_upload_converts_and_serves_mesh(client: TestClient, extension: str):
    mesh = trimesh.creation.box()
    mesh.apply_translation([8, 2, -3])
    response = client.post(
        "/uploads",
        params={"filename": f"my bone.{extension}"},
        content=mesh.export(file_type=extension),
    )
    assert response.status_code == 202
    job = client.get(f"/uploads/{response.json()['id']}").json()
    assert job["status"] == "ready"
    assert not (
        get_specimen_store().assets_dir / ".uploads" / job["id"] / "raw"
    ).exists()
    specimen = client.get(f"/specimens/{job['specimenId']}").json()
    assert specimen["citation"]["datasetUrl"] is None
    assert specimen["scientificName"] == "my bone"
    structure = specimen["structures"][0]
    assert structure["bounds"] == {"min": [7.5, 1.5, -3.5], "max": [8.5, 2.5, -2.5]}
    assert structure["triangleCount"] == 12
    glb = client.get(structure["meshUrl"])
    assert glb.status_code == 200
    assert glb.content[:4] == b"glTF"
    assert len(client.get("/specimens").json()) == 1


def test_unreadable_upload_never_publishes_specimen(client: TestClient):
    response = client.post("/uploads?filename=broken.stl", content=b"not a mesh")
    job = client.get(f"/uploads/{response.json()['id']}").json()
    assert job["status"] == "failed"
    assert not (
        get_specimen_store().assets_dir / ".uploads" / job["id"] / "raw"
    ).exists()
    assert job["error"]
    assert client.get("/specimens").json() == []


@pytest.mark.parametrize(
    "name", ["../bone.stl", "C:\\bone.ply", "bone.obj", "bone.glb"]
)
def test_rejects_invalid_filenames(client: TestClient, name: str):
    response = client.post("/uploads", params={"filename": name}, content=b"mesh")
    assert response.status_code == 400


def test_rejects_empty_and_oversize_uploads(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    assert client.post("/uploads?filename=bone.stl", content=b"").status_code == 400
    monkeypatch.setattr(uploads, "MAX_UPLOAD_BYTES", 4)
    assert (
        client.post("/uploads?filename=bone.stl", content=b"12345").status_code == 413
    )
    assert list((get_specimen_store().assets_dir / ".uploads").iterdir()) == []


def test_unknown_job_and_busy_converter(client: TestClient):
    assert client.get("/uploads/not-a-job").status_code == 404
    assert client.get(f"/uploads/upload-{'0' * 32}").status_code == 404
    uploads._slots.acquire()
    uploads._slots.acquire()
    try:
        response = client.post("/uploads?filename=bone.stl", content=b"mesh")
        assert response.status_code == 429
    finally:
        uploads._slots.release()
        uploads._slots.release()


def test_interrupted_job_returns_actionable_error(client: TestClient):
    directory = get_specimen_store().assets_dir / ".uploads" / f"upload-{'1' * 32}"
    directory.mkdir(parents=True)
    uploads._save_status(
        directory, uploads.UploadStatus(id=directory.name, status="processing")
    )
    response = client.get(f"/uploads/{directory.name}")
    assert response.json()["status"] == "failed"
    assert "interrupted" in response.json()["error"]


def test_uploaded_mesh_has_no_grounded_ai_source(client: TestClient):
    from fastapi import HTTPException

    response = client.post(
        "/uploads?filename=bone.stl",
        content=trimesh.creation.box().export(file_type="stl"),
    )
    with pytest.raises(HTTPException) as caught:
        _grounded_specimen(response.json()["id"])
    assert caught.value.status_code == 422
