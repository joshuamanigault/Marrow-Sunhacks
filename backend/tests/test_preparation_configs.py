from __future__ import annotations

import copy
import hashlib
import importlib.util
import zipfile
from pathlib import Path

import pytest
import trimesh
from pydantic import ValidationError

from marrow.specimens.preparation import (
    PreparationConfig,
    SourceFile,
    catalog_ids,
    load_config,
)
from marrow.specimens.store import SpecimenStore

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_ten_distinct_specimens_with_individual_sources() -> None:
    configs = [load_config(specimen_id) for specimen_id in catalog_ids()]
    assert len(configs) == 10
    assert len({c.metadata.accession for c in configs}) == 10
    assert len({c.metadata.scientificName for c in configs}) == 10
    for config in configs:
        assert config.metadata.id in catalog_ids()
        assert config.metadata.credits
        assert config.metadata.reuseTerms.license == "CC0-1.0"
        if config.metadata.id != "ypm-vp-41198":
            assert config.sourceFiles


def test_second_specimen_prepares_and_serves_its_own_mesh(tmp_path: Path) -> None:
    prep = script("prepare_specimen")
    config = load_config("dino-15914")
    raw = tmp_path / "raw"
    raw.mkdir()
    source = raw / "Braincase.stl"
    trimesh.creation.box().export(source)
    catalog = config.structure_catalog(raw)
    out = tmp_path / "prepared" / config.metadata.id
    inventory = prep.inventory_meshes(raw, catalog)
    converted = prep.convert_one(
        catalog[source.name],
        raw,
        out / "meshes",
        max_faces=80_000,
        force=False,
    )
    prep.write_manifest(
        out,
        inventory,
        [converted],
        max_faces=80_000,
        archive_check=None,
        config=config,
        catalog=catalog,
    )
    store = SpecimenStore(out.parent)
    item = store.get_specimen(config.metadata.id)
    assert item.accession == "DINO 15914"
    assert item.citation.datasetDoi.endswith("rbnzs7hjc")
    assert {s.id for s in item.structures} == {s.id for s in config.structures}
    skull = next(s for s in item.structures if s.id == "braincase")
    assert skull.meshUrl == "/specimens/dino-15914/meshes/braincase.glb"
    assert skull.triangleCount == 12
    assert store.resolve_mesh(item.id, "braincase").read_bytes()[:4] == b"glTF"
    assert all(s.status == "missing" for s in item.structures if s.id != "braincase")


def test_discovery_preserves_nested_source_labels_and_rejects_collisions(
    tmp_path: Path,
) -> None:
    config = load_config("uamz-r636").model_copy(update={"structures": []})
    nested = tmp_path / "Mesh Files (Adult)"
    nested.mkdir()
    (nested / "Left Maxilla.STL").touch()
    catalog = config.structure_catalog(tmp_path)
    entry = catalog["Mesh Files (Adult)/Left Maxilla.STL"]
    assert entry.id == "left_maxilla"
    assert entry.name == "Left Maxilla"
    assert entry.side == "none"
    (nested / "Left_Maxilla.stl").touch()
    with pytest.raises(ValueError, match="unique structure ids"):
        config.structure_catalog(tmp_path)


@pytest.mark.parametrize("field,value", [("rawDir", "../escape"), ("id", "../escape")])
def test_config_rejects_unsafe_paths(field: str, value: str) -> None:
    data = copy.deepcopy(load_config("dino-15914").model_dump(mode="json"))
    if field == "id":
        data["metadata"][field] = value
    else:
        data[field] = value
    with pytest.raises(ValidationError):
        PreparationConfig.model_validate(data)


def test_checksum_rejects_same_size_corruption(tmp_path: Path) -> None:
    fetch = script("fetch_specimens")
    path = tmp_path / "source.stl"
    content = b"published data"
    path.write_bytes(content)
    source = SourceFile(
        filename=path.name,
        fileId=1,
        size=len(content),
        digest=hashlib.sha256(content).hexdigest(),
        digestType="sha-256",
    )
    assert fetch.verify_source(path, source)
    path.write_bytes(b"corrupted data")
    assert not fetch.verify_source(path, source)


def test_extraction_rejects_traversal_before_writing(tmp_path: Path) -> None:
    fetch = script("fetch_specimens")
    archive = tmp_path / "sources.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("good.stl", "valid")
        bundle.writestr("../escape.stl", "bad")
    with pytest.raises(ValueError, match="Unsafe"):
        fetch.extract_meshes(archive, tmp_path / "raw")
    assert not (tmp_path / "raw" / "good.stl").exists()
    assert not (tmp_path / "escape.stl").exists()


def test_source_labels_do_not_make_unprepared_specimens_public(tmp_path: Path) -> None:
    config = load_config("dino-15914")
    (tmp_path / "dino-15914.json").write_text(config.model_dump_json())
    assert SpecimenStore(tmp_path).list_specimens() == []
    # A malformed discovery config fails before a manifest can be generated.
    with pytest.raises(ValueError, match="No source meshes"):
        load_config("uamz-r636").model_copy(
            update={"structures": []}
        ).structure_catalog(tmp_path)


def test_nested_ply_archive_filters_metadata_and_converts(tmp_path: Path) -> None:
    archive = tmp_path / "source.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        mesh = trimesh.creation.box()
        mesh.apply_translation([7, 8, 9])
        data = mesh.export(file_type="ply")
        assert isinstance(data, bytes)
        bundle.writestr("parts/Maxilla.PLY", data)
        for name in ("__MACOSX/parts/Maxilla.ply", "parts/._Maxilla.ply", ".DS_Store"):
            bundle.writestr(name, "metadata")
    raw = tmp_path / "raw"
    script("fetch_specimens").extract_meshes(archive, raw)
    assert [p.name for p in raw.rglob("*") if p.is_file()] == ["Maxilla.PLY"]
    config = load_config("uamz-r636").model_copy(update={"structures": []})
    catalog = config.structure_catalog(raw)
    prep = script("prepare_specimen")
    assert prep.inventory_meshes(raw, catalog)[0]["triangleCount"] == 12
    result = prep.convert_one(
        catalog["parts/Maxilla.PLY"],
        raw,
        tmp_path / "out",
        max_faces=80000,
        force=False,
    )
    assert result["bounds"]["min"] == [6.5, 7.5, 8.5]


@pytest.mark.parametrize("bundle", [False, True])
def test_manual_download_import(tmp_path: Path, bundle: bool) -> None:
    fetch = script("fetch_specimens")
    data = b"verified mesh"
    source = SourceFile(
        filename="Test file.ply",
        size=len(data),
        fileId=2,
        digest=hashlib.sha256(data).hexdigest(),
        digestType="sha-256",
    )
    directory = tmp_path / "downloads"
    directory.mkdir()
    if bundle:
        with zipfile.ZipFile(directory / "doi_10_5061_dryad_abc__v2025.zip", "w") as z:
            z.writestr("nested/Test file.ply", data)
    else:
        (directory / "Test+file(1).ply").write_bytes(data)
    target = tmp_path / source.filename
    assert fetch.import_download(source, target, directory, "10.5061/dryad.abc")
    assert target.read_bytes() == data
