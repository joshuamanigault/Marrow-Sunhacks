from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from marrow.main import app
from marrow.models.specimen import SpecimenResponse

client = TestClient(app)

FIXTURE_GLB = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "assets"
    / "ypm-vp-41198"
    / "meshes"
    / "nasal_r.glb"
)


def test_specimen_contract_shape() -> None:
    response = client.get("/specimens/ypm-vp-41198")
    assert response.status_code == 200
    payload = SpecimenResponse.model_validate(response.json())
    assert payload.id == "ypm-vp-41198"
    assert payload.accession == "YPM VP 41198"
    assert payload.reuseTerms.license == "CC0-1.0"
    assert payload.coordinates.sourceToDisplay == "identity"
    assert payload.coordinates.frame == "source_stl"

    by_id = {s.id: s for s in payload.structures}
    assert by_id["nasal_r"].status == "ok"
    assert by_id["nasal_r"].side == "right"
    assert by_id["nasal_r"].meshUrl == (
        "/specimens/ypm-vp-41198/meshes/nasal_r.glb"
    )
    assert by_id["maxilla_l"].status == "missing"
    assert by_id["maxilla_l"].meshUrl is None
    assert by_id["maxilla_l"].side == "left"
    assert by_id["quadrate_l"].status == "unreadable"
    assert by_id["quadrate_l"].meshUrl is None


def test_mesh_delivery_returns_glb_bytes() -> None:
    response = client.get("/specimens/ypm-vp-41198/meshes/nasal_r.glb")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("model/gltf-binary")
    body = response.content
    assert body[:4] == b"glTF"
    assert body == FIXTURE_GLB.read_bytes()


def test_unavailable_mesh_returns_404() -> None:
    missing = client.get("/specimens/ypm-vp-41198/meshes/maxilla_l.glb")
    assert missing.status_code == 404
    unreadable = client.get("/specimens/ypm-vp-41198/meshes/quadrate_l.glb")
    assert unreadable.status_code == 404


def test_unknown_specimen_returns_404() -> None:
    response = client.get("/specimens/does-not-exist")
    assert response.status_code == 404


def test_path_traversal_rejected() -> None:
    response = client.get("/specimens/ypm-vp-41198/meshes/../manifest.json")
    assert response.status_code in {400, 404, 422}


def test_invalid_specimen_id_rejected() -> None:
    response = client.get("/specimens/../prepared")
    assert response.status_code in {400, 404, 422}
