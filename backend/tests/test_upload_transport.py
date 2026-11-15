from pathlib import Path
from runpy import run_path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from marrow.main import app
from marrow.routes import uploads


def test_direct_upload_only_sends_metadata_to_api(monkeypatch: pytest.MonkeyPatch):
    bucket = Mock()
    job_id = "upload-" + "a" * 32
    bucket.initiate.return_value = {
        "id": job_id,
        "url": "https://bucket.example",
        "fields": {"key": f"incoming/{job_id}/source.stl"},
    }
    bucket.status.return_value = {"id": job_id, "status": "ready", "specimenId": job_id}
    monkeypatch.setattr(uploads, "get_upload_bucket", lambda: bucket)
    with TestClient(app) as client:
        size = 100 * 1024 * 1024
        start = client.post(
            "/uploads/init", json={"filename": "scan.stl", "size": size}
        )
        assert start.json() == {"mode": "direct", **bucket.initiate.return_value}
        bucket.initiate.assert_called_once_with("scan.stl", size)
        assert client.get(f"/uploads/{job_id}").json()["specimenId"] == job_id
        assert (
            client.post("/uploads?filename=scan.stl", content=b"raw").status_code == 400
        )


def test_local_upload_plan_and_shared_validation(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(uploads, "get_upload_bucket", lambda: None)
    with TestClient(app) as client:
        for filename, size, code in [
            ("scan.ply", 10, 200),
            ("scan.obj", 10, 400),
            ("../scan.stl", 1, 400),
            ("scan.stl", 0, 400),
            ("scan.stl", uploads.MAX_UPLOAD_BYTES + 1, 413),
        ]:
            response = client.post(
                "/uploads/init", json={"filename": filename, "size": size}
            )
            assert response.status_code == code
            if code == 200:
                assert response.json() == {"mode": "local"}


def test_deployment_routes_uploads_once_without_changing_existing_behaviors():
    deploy = run_path(
        str(Path(__file__).resolve().parents[1] / "scripts/deploy_uploads.py")
    )
    ai = {"PathPattern": "/ai*", "TargetOriginId": "lambda", "ForwardedValues": {}}
    mesh = {"PathPattern": "/specimens/*/meshes/*", "TargetOriginId": "meshes"}
    config = {"CacheBehaviors": {"Quantity": 2, "Items": [mesh, ai]}}
    assert deploy["route_uploads"](config)
    uploads_route, *prior = config["CacheBehaviors"]["Items"]
    assert uploads_route["PathPattern"] == "/uploads*"
    assert uploads_route["TargetOriginId"] == "lambda"
    assert uploads_route["CachePolicyId"] == deploy["CACHING_DISABLED"]
    assert "POST" in uploads_route["AllowedMethods"]["Items"]
    assert "ForwardedValues" not in uploads_route
    assert prior == [mesh, ai]
    assert not deploy["route_uploads"](config)
