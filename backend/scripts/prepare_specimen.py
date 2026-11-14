"""Inventory Appendix 2 STLs and convert them to browser-ready GLBs.

Usage (from backend/):

  uv run python scripts/prepare_specimen.py inventory
  uv run python scripts/prepare_specimen.py convert --limit 3
  uv run python scripts/prepare_specimen.py convert
  uv run python scripts/prepare_specimen.py write-manifest

Preserves source vertex positions (identity transform). Does not invent
anatomy, center individual bones, or apply MRI/brain cleanup heuristics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import trimesh

# Allow running as `uv run python scripts/prepare_specimen.py`.
ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = Path(__file__).resolve().parents[1] / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from marrow.structures import (  # noqa: E402
    SPECIMEN_ID,
    STRUCTURE_CATALOG,
    StructureDef,
)

DEFAULT_RAW = ROOT / "data" / "raw" / "appendix2" / "Appendix2"
DEFAULT_OUT = ROOT / "data" / "prepared" / SPECIMEN_ID
DEFAULT_ARCHIVE = Path.home() / "Downloads" / "Appendix2.zip"
EXPECTED_SHA256 = "bf221aa2e981eb32f090926bee9f9e20b317608600add737f7917baed8d2cb7b"
DEFAULT_MAX_FACES = 80_000
CONVERSION_VERSION = "1"


def sha256_file(path: Path, chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=DEFAULT_RAW,
        help="Directory containing Appendix 2 STL files",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT,
        help="Prepared specimen output directory",
    )
    parser.add_argument(
        "--archive",
        type=Path,
        default=DEFAULT_ARCHIVE,
        help="Optional Appendix2.zip for checksum verification",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    inv = sub.add_parser("inventory", help="Read every STL and write inventory.json")
    inv.add_argument("--verify-archive", action="store_true")

    conv = sub.add_parser("convert", help="Convert STLs to per-structure GLBs")
    conv.add_argument("--limit", type=int, default=None)
    conv.add_argument("--ids", nargs="*", default=None, help="Only these structure ids")
    conv.add_argument("--max-faces", type=int, default=DEFAULT_MAX_FACES)
    conv.add_argument("--force", action="store_true")

    man = sub.add_parser(
        "write-manifest",
        help="Rebuild manifest.json from inventory + existing GLBs",
    )
    man.add_argument("--max-faces", type=int, default=DEFAULT_MAX_FACES)

    all_cmd = sub.add_parser("all", help="inventory → convert → write-manifest")
    all_cmd.add_argument("--limit", type=int, default=None)
    all_cmd.add_argument("--ids", nargs="*", default=None)
    all_cmd.add_argument("--max-faces", type=int, default=DEFAULT_MAX_FACES)
    all_cmd.add_argument("--verify-archive", action="store_true")
    all_cmd.add_argument("--force", action="store_true")

    return parser.parse_args()


def verify_archive(archive: Path) -> dict[str, Any]:
    if not archive.is_file():
        raise FileNotFoundError(f"Archive not found: {archive}")
    digest = sha256_file(archive)
    ok = digest.lower() == EXPECTED_SHA256
    return {
        "path": str(archive),
        "sha256": digest,
        "expected": EXPECTED_SHA256,
        "matchesPublished": ok,
        "bytes": archive.stat().st_size,
    }


def load_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="mesh", process=False)
    if not isinstance(loaded, trimesh.Trimesh):
        raise ValueError(f"Expected Trimesh, got {type(loaded)}")
    if len(loaded.faces) == 0 or len(loaded.vertices) == 0:
        raise ValueError("Empty mesh")
    return loaded


def inventory_meshes(raw_dir: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    stl_files = sorted(raw_dir.glob("*.stl"))
    known = set(STRUCTURE_CATALOG)
    found = {p.name for p in stl_files}

    for path in stl_files:
        entry = STRUCTURE_CATALOG.get(path.name)
        row: dict[str, Any] = {
            "sourceFilename": path.name,
            "bytes": path.stat().st_size,
            "structureId": entry.id if entry else None,
            "name": entry.name if entry else None,
            "side": entry.side if entry else None,
            "inPublishedInventory": path.name in known,
        }
        try:
            mesh = load_mesh(path)
            bounds = mesh.bounds
            row.update(
                {
                    "status": "ok",
                    "triangleCount": int(len(mesh.faces)),
                    "vertexCount": int(len(mesh.vertices)),
                    "bounds": {
                        "min": [float(x) for x in bounds[0]],
                        "max": [float(x) for x in bounds[1]],
                    },
                    "error": None,
                }
            )
        except Exception as exc:  # noqa: BLE001 — record per-file failures
            row.update(
                {
                    "status": "unreadable",
                    "triangleCount": None,
                    "vertexCount": None,
                    "bounds": None,
                    "error": str(exc),
                }
            )
        rows.append(row)

    for missing_name in sorted(known - found):
        entry = STRUCTURE_CATALOG[missing_name]
        rows.append(
            {
                "sourceFilename": missing_name,
                "bytes": None,
                "structureId": entry.id,
                "name": entry.name,
                "side": entry.side,
                "inPublishedInventory": True,
                "status": "missing",
                "triangleCount": None,
                "vertexCount": None,
                "bounds": None,
                "error": "File not present in extracted archive",
            }
        )
    return rows


def convert_one(
    entry: StructureDef,
    raw_dir: Path,
    meshes_dir: Path,
    *,
    max_faces: int,
    force: bool,
) -> dict[str, Any]:
    src = raw_dir / entry.source_filename
    out = meshes_dir / f"{entry.id}.glb"
    if out.exists() and not force:
        return {
            "id": entry.id,
            "status": "ok",
            "meshFile": f"meshes/{entry.id}.glb",
            "skipped": True,
            "bytes": out.stat().st_size,
        }
    if not src.is_file():
        return {
            "id": entry.id,
            "status": "missing",
            "meshFile": None,
            "error": "source STL missing",
        }

    try:
        mesh = load_mesh(src)
        source_faces = int(len(mesh.faces))
        source_bounds = {
            "min": [float(x) for x in mesh.bounds[0]],
            "max": [float(x) for x in mesh.bounds[1]],
        }
        # Index duplicate STL vertices; do not translate/scale.
        mesh.merge_vertices()
        decimated = False
        if len(mesh.faces) > max_faces:
            mesh = mesh.simplify_quadric_decimation(face_count=max_faces)
            decimated = True
        export_bounds = {
            "min": [float(x) for x in mesh.bounds[0]],
            "max": [float(x) for x in mesh.bounds[1]],
        }
        scene = trimesh.Scene()
        scene.add_geometry(
            mesh,
            node_name=entry.id,
            geom_name=entry.id,
            transform=np.eye(4),
        )
        meshes_dir.mkdir(parents=True, exist_ok=True)
        scene.export(out)
        return {
            "id": entry.id,
            "status": "ok",
            "meshFile": f"meshes/{entry.id}.glb",
            "sourceFilename": entry.source_filename,
            "sourceTriangleCount": source_faces,
            "triangleCount": int(len(mesh.faces)),
            "decimated": decimated,
            "maxFaces": max_faces,
            "sourceToDisplay": "identity",
            "sourceBounds": source_bounds,
            "bounds": export_bounds,
            "bytes": out.stat().st_size,
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "id": entry.id,
            "status": "unreadable",
            "meshFile": None,
            "sourceFilename": entry.source_filename,
            "error": str(exc),
        }


def specimen_metadata() -> dict[str, Any]:
    return {
        "id": SPECIMEN_ID,
        "scientificName": "Eosphorosuchus lacrimosa",
        "commonLabel": "Eosphorosuchus lacrimosa",
        "accession": "YPM VP 41198",
        "institution": "Yale Peabody Museum",
        "citation": {
            "text": (
                "Margulis-Ohnuma, M., Ruebenstahl, A., Meyer, D., & Bhullar, B.-A. "
                "(2026). Data for: A short-snouted \"sphenosuchian\" with unusual "
                "feeding anatomy demonstrates that ecological specialization occurred "
                "early in crocodylomorph evolution. Dryad. "
                "https://doi.org/10.5061/dryad.q83bk3jvv"
            ),
            "datasetDoi": "10.5061/dryad.q83bk3jvv",
            "datasetUrl": "https://doi.org/10.5061/dryad.q83bk3jvv",
            "articleDoi": "10.1098/rspb.2026.0130",
            "articleUrl": "https://doi.org/10.1098/rspb.2026.0130",
        },
        "credits": [
            "Miranda Margulis-Ohnuma",
            "Alexander Ruebenstahl",
            "Dalton Meyer",
            "Bhart-Anjan Bhullar",
        ],
        "reuseTerms": {
            "license": "CC0-1.0",
            "licenseUrl": "https://spdx.org/licenses/CC0-1.0.html",
            "notes": (
                "Dryad reports CC0-1.0. Retain specimen identity, researcher "
                "credits, and dataset DOI in the application."
            ),
        },
        "coordinates": {
            "frame": "source_stl",
            "units": "unknown",
            "axisConvention": "unknown",
            "sourceToDisplay": "identity",
            "notes": (
                "Vertices are the Appendix 2 STL positions with an identity "
                "node transform. Relative placement across bones is preserved "
                "by not centering or scaling individuals. Units and anatomical "
                "axis convention are not stated in the Appendix 2 README; CT "
                "scan metadata (Appendix 1) was not inspected for this mesh pipeline."
            ),
        },
    }


def write_manifest(
    out_dir: Path,
    inventory: list[dict[str, Any]],
    conversion: list[dict[str, Any]],
    *,
    max_faces: int,
    archive_check: dict[str, Any] | None,
) -> Path:
    by_id = {row["id"]: row for row in conversion if "id" in row}
    inv_by_file = {row["sourceFilename"]: row for row in inventory}
    structures: list[dict[str, Any]] = []

    for filename, entry in STRUCTURE_CATALOG.items():
        inv = inv_by_file.get(filename, {})
        conv = by_id.get(entry.id)
        glb_rel = f"meshes/{entry.id}.glb"
        glb_path = out_dir / glb_rel

        if conv is not None:
            status = conv["status"]
            mesh_file = conv.get("meshFile")
            triangle_count = conv.get("triangleCount") or inv.get("triangleCount")
            bounds = conv.get("bounds") or inv.get("bounds")
            error = conv.get("error")
        elif glb_path.is_file():
            status = "ok"
            mesh_file = glb_rel
            triangle_count = inv.get("triangleCount")
            bounds = inv.get("bounds")
            error = None
        else:
            status = inv.get("status") or "missing"
            if status == "ok":
                # Source readable but GLB not prepared yet.
                status = "missing"
            mesh_file = None
            triangle_count = inv.get("triangleCount")
            bounds = inv.get("bounds")
            error = inv.get("error") or "GLB not prepared"

        if status == "ok":
            if not mesh_file:
                mesh_file = glb_rel
            if not (out_dir / mesh_file).is_file():
                status = "missing"
                mesh_file = None
                error = "Declared GLB missing on disk"

        structures.append(
            {
                "id": entry.id,
                "name": entry.name,
                "side": entry.side,
                "sourceFilename": entry.source_filename,
                "status": status,
                "meshFile": mesh_file,
                "triangleCount": triangle_count,
                "bounds": bounds,
                "error": error,
            }
        )

    union_min = None
    union_max = None
    for structure in structures:
        b = structure.get("bounds")
        if not b:
            continue
        mins = np.array(b["min"], dtype=float)
        maxs = np.array(b["max"], dtype=float)
        union_min = mins if union_min is None else np.minimum(union_min, mins)
        union_max = maxs if union_max is None else np.maximum(union_max, maxs)

    payload = {
        **specimen_metadata(),
        "preparedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "conversion": {
            "version": CONVERSION_VERSION,
            "maxFaces": max_faces,
            "sourceToDisplay": "identity",
            "tools": ["trimesh", "fast-simplification"],
            "notes": (
                "Per-structure GLB with named node = structure id. "
                "merge_vertices for indexing; optional quadric decimation "
                "when face count exceeds maxFaces. No per-bone centering."
            ),
        },
        "archive": archive_check,
        "assemblyBounds": None
        if union_min is None
        else {"min": union_min.tolist(), "max": union_max.tolist()},
        "structures": structures,
        "catalog": [asdict(v) for v in STRUCTURE_CATALOG.values()],
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def cmd_inventory(args: argparse.Namespace) -> None:
    archive_check = None
    if getattr(args, "verify_archive", False):
        archive_check = verify_archive(args.archive)
        print(json.dumps({"archive": archive_check}, indent=2))
        if not archive_check["matchesPublished"]:
            raise SystemExit("Archive checksum mismatch")
    rows = inventory_meshes(args.raw_dir)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    path = args.out_dir / "inventory.json"
    path.write_text(
        json.dumps({"archive": archive_check, "structures": rows}, indent=2),
        encoding="utf-8",
    )
    ok = sum(1 for r in rows if r["status"] == "ok")
    print(f"Inventoried {len(rows)} entries ({ok} ok) → {path}")


def cmd_convert(args: argparse.Namespace) -> list[dict[str, Any]]:
    entries = list(STRUCTURE_CATALOG.values())
    if args.ids:
        wanted = set(args.ids)
        entries = [e for e in entries if e.id in wanted]
        missing = wanted - {e.id for e in entries}
        if missing:
            raise SystemExit(f"Unknown structure ids: {sorted(missing)}")
    if args.limit is not None:
        entries = entries[: args.limit]

    meshes_dir = args.out_dir / "meshes"
    results: list[dict[str, Any]] = []
    for entry in entries:
        print(f"converting {entry.source_filename} → {entry.id}.glb ...", flush=True)
        result = convert_one(
            entry,
            args.raw_dir,
            meshes_dir,
            max_faces=args.max_faces,
            force=args.force,
        )
        results.append(result)
        size = (
            f" {result.get('bytes', 0) / 1024:.1f} KiB"
            if result.get("bytes")
            else ""
        )
        faces = (
            f" faces={result.get('triangleCount')}"
            if result.get("triangleCount")
            else ""
        )
        print(f"  {result['status']}{size}{faces}", flush=True)

    log_path = args.out_dir / "conversion-log.json"
    args.out_dir.mkdir(parents=True, exist_ok=True)
    log_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Wrote {log_path}")
    return results


def cmd_write_manifest(args: argparse.Namespace) -> None:
    inv_path = args.out_dir / "inventory.json"
    log_path = args.out_dir / "conversion-log.json"
    inventory = []
    if inv_path.is_file():
        data = json.loads(inv_path.read_text(encoding="utf-8"))
        inventory = data.get("structures", [])
    else:
        inventory = inventory_meshes(args.raw_dir)
    conversion = []
    if log_path.is_file():
        conversion = json.loads(log_path.read_text(encoding="utf-8"))
    archive_check = None
    if args.archive.is_file():
        try:
            archive_check = verify_archive(args.archive)
        except OSError:
            archive_check = None
    path = write_manifest(
        args.out_dir,
        inventory,
        conversion,
        max_faces=args.max_faces,
        archive_check=archive_check,
    )
    print(f"Wrote {path}")


def main() -> None:
    args = parse_args()
    if args.command == "inventory":
        cmd_inventory(args)
    elif args.command == "convert":
        cmd_convert(args)
    elif args.command == "write-manifest":
        cmd_write_manifest(args)
    elif args.command == "all":
        cmd_inventory(args)
        cmd_convert(args)
        cmd_write_manifest(args)
    else:
        raise SystemExit(f"Unknown command {args.command}")


if __name__ == "__main__":
    main()
