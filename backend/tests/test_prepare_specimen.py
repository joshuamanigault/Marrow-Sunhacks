from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import trimesh

from marrow.structures import StructureDef

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
BACKEND_SRC = ROOT / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))


def _load_prepare_module():
    path = SCRIPTS / "prepare_specimen.py"
    spec = importlib.util.spec_from_file_location("prepare_specimen", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prep = _load_prepare_module()


def _write_tiny_glb(path: Path, *, faces: int = 4) -> None:
    verts = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
    base = np.array([[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]], dtype=np.int64)
    face_list = [base[i % 4] for i in range(faces)]
    mesh = trimesh.Trimesh(vertices=verts, faces=np.array(face_list), process=False)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name="demo", geom_name="demo", transform=np.eye(4))
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(path)


def test_skip_preserves_glb_triangle_count(tmp_path: Path) -> None:
    meshes = tmp_path / "meshes"
    glb = meshes / "nasal_r.glb"
    _write_tiny_glb(glb, faces=4)

    prior = {
        "id": "nasal_r",
        "status": "ok",
        "triangleCount": 4,
        "sourceTriangleCount": 2_000_000,
        "decimated": True,
        "maxFaces": 80_000,
        "bounds": {"min": [0, 0, 0], "max": [1, 1, 1]},
    }
    entry = StructureDef("nasal_r", "Nasal", "right", "nasalR.stl")
    result = prep.convert_one(
        entry,
        raw_dir=tmp_path,
        meshes_dir=meshes,
        max_faces=80_000,
        force=False,
        prior=prior,
    )
    assert result["skipped"] is True
    assert result["triangleCount"] == 4
    assert result["sourceTriangleCount"] == 2_000_000
    assert result["decimated"] is True
    assert result["bounds"]["min"] == [0.0, 0.0, 0.0]


def test_write_manifest_does_not_use_stl_counts_for_existing_glb(
    tmp_path: Path,
) -> None:
    meshes = tmp_path / "meshes"
    glb = meshes / "nasal_r.glb"
    _write_tiny_glb(glb, faces=4)

    inventory = [
        {
            "sourceFilename": "nasalR.stl",
            "status": "ok",
            "triangleCount": 2_000_000,
            "bounds": {"min": [-99.0, -99.0, -99.0], "max": [99.0, 99.0, 99.0]},
        }
    ]
    conversion = [
        {
            "id": "nasal_r",
            "status": "ok",
            "meshFile": "meshes/nasal_r.glb",
            "skipped": True,
            "bytes": glb.stat().st_size,
        }
    ]
    path = prep.write_manifest(
        tmp_path,
        inventory,
        conversion,
        max_faces=80_000,
        archive_check=None,
    )
    manifest = json.loads(path.read_text(encoding="utf-8"))
    nasal = next(s for s in manifest["structures"] if s["id"] == "nasal_r")
    assert nasal["status"] == "ok"
    assert nasal["triangleCount"] == 4
    assert nasal["bounds"]["min"] != [-99.0, -99.0, -99.0]
    assert nasal["color"] == StructureDef(
        "nasal_r", "Nasal", "right", "nasalR.stl"
    ).color
    maxilla_l = next(s for s in manifest["structures"] if s["id"] == "maxilla_l")
    maxilla_r = next(s for s in manifest["structures"] if s["id"] == "maxilla_r")
    assert maxilla_l["color"] != maxilla_r["color"]


def test_decimation_keeps_a_detached_fragment_in_the_same_structure() -> None:
    main = trimesh.creation.icosphere(subdivisions=3)
    fragment = trimesh.creation.box(extents=[0.1, 0.1, 0.1])
    fragment.apply_translation([9, 0, 0])
    source = trimesh.util.concatenate([main, fragment])
    simplified = main.simplify_quadric_decimation(face_count=100)
    result = prep.preserve_small_fragments(source, simplified, 100)
    assert len(result.faces) <= 100
    assert np.isclose(result.bounds[1, 0], source.bounds[1, 0])
    assert len(result.vertices[result.vertices[:, 0] > 8]) == len(fragment.vertices)
