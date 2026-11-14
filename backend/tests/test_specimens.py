from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from marrow.main import app
from marrow.models.specimen import SpecimenListItem, SpecimenResponse
from marrow.settings import get_settings
from marrow.specimens.store import get_specimen_store
from marrow.structures import color_for_structure_id

_HEX = re.compile(r"^#[0-9a-f]{6}$")

client = TestClient(app)

FIXTURE_GLB = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "assets"
    / "ypm-vp-41198"
    / "meshes"
    / "nasal_r.glb"
)


def test_specimen_list_includes_curated_fixture() -> None:
    response = client.get("/specimens")
    assert response.status_code == 200
    items = [SpecimenListItem.model_validate(row) for row in response.json()]
    assert len(items) >= 1
    by_id = {item.id: item for item in items}
    curated = by_id["ypm-vp-41198"]
    assert curated.scientificName == "Eosphorosuchus lacrimosa"
    assert curated.accession == "YPM VP 41198"
    assert curated.commonLabel == "Eosphorosuchus lacrimosa"
    assert curated.institution == "Yale Peabody Museum"


def test_specimen_list_empty_when_assets_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    empty_dir = tmp_path / "prepared"
    empty_dir.mkdir()
    monkeypatch.setenv("ASSETS_DIR", str(empty_dir))
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
    try:
        response = client.get("/specimens")
        assert response.status_code == 200
        assert response.json() == []
    finally:
        get_settings.cache_clear()
        get_specimen_store.cache_clear()


def test_specimen_list_skips_invalid_manifests(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "prepared"
    (root / "bad-id!").mkdir(parents=True)
    (root / "no-manifest").mkdir()
    broken = root / "broken-id"
    broken.mkdir()
    (broken / "manifest.json").write_text("{not-json", encoding="utf-8")
    mismatch = root / "id-mismatch"
    mismatch.mkdir()
    (mismatch / "manifest.json").write_text(
        '{"id":"other","scientificName":"X","accession":"Y"}',
        encoding="utf-8",
    )
    good = root / "ypm-vp-41198"
    good.mkdir()
    (good / "manifest.json").write_text(
        (
            '{"id":"ypm-vp-41198","scientificName":"Eosphorosuchus lacrimosa",'
            '"accession":"YPM VP 41198","commonLabel":"Eosphorosuchus lacrimosa",'
            '"institution":"Yale Peabody Museum"}'
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("ASSETS_DIR", str(root))
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
    try:
        response = client.get("/specimens")
        assert response.status_code == 200
        items = [SpecimenListItem.model_validate(row) for row in response.json()]
        assert [item.id for item in items] == ["ypm-vp-41198"]
    finally:
        get_settings.cache_clear()
        get_specimen_store.cache_clear()


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
    assert by_id["nasal_r"].color == color_for_structure_id("nasal_r")
    assert by_id["nasal_r"].color is not None
    assert _HEX.fullmatch(by_id["nasal_r"].color)
    assert by_id["maxilla_l"].status == "missing"
    assert by_id["maxilla_l"].meshUrl is None
    assert by_id["maxilla_l"].side == "left"
    assert by_id["maxilla_l"].color == color_for_structure_id("maxilla_l")
    assert by_id["quadrate_l"].status == "unreadable"
    assert by_id["quadrate_l"].meshUrl is None
    assert by_id["quadrate_l"].color == color_for_structure_id("quadrate_l")


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
