"""Shared mesh conversion for prepared specimens and user uploads."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import numpy as np
import trimesh

from marrow.structures import StructureDef


def load_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="mesh", process=False)
    if not isinstance(loaded, trimesh.Trimesh):
        raise ValueError(f"Expected Trimesh, got {type(loaded)}")
    if len(loaded.faces) == 0 or len(loaded.vertices) == 0:
        raise ValueError("Empty mesh")
    if not np.isfinite(loaded.vertices).all():
        raise ValueError("Mesh contains non-finite coordinates")
    return loaded


def glb_geometry_stats(path: Path) -> dict[str, Any]:
    """Read triangle count and bounds from a prepared GLB (authoritative on disk)."""
    loaded = trimesh.load(path, force="scene")
    if isinstance(loaded, trimesh.Trimesh):
        mesh = loaded
    elif isinstance(loaded, trimesh.Scene):
        geoms = list(loaded.geometry.values())
        if not geoms:
            raise ValueError(f"GLB has no geometry: {path}")
        mesh = geoms[0] if len(geoms) == 1 else trimesh.util.concatenate(geoms)
    else:
        raise ValueError(f"Unexpected GLB type {type(loaded)} for {path}")
    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"Expected Trimesh geometry in {path}")
    return {
        "triangleCount": int(len(mesh.faces)),
        "bounds": {
            "min": [float(x) for x in mesh.bounds[0]],
            "max": [float(x) for x in mesh.bounds[1]],
        },
    }


def simplify_to_budget(mesh: trimesh.Trimesh, max_faces: int) -> trimesh.Trimesh:
    mesh = mesh.simplify_quadric_decimation(face_count=max_faces)
    if len(mesh.faces) > max_faces:
        # Dense, nearly coincident triangles can stall quadric decimation.
        # Weld points within small grid cells using an actual source position.
        cell_size = float(mesh.extents.max()) / 1024
        cells = np.rint((mesh.vertices - mesh.bounds[0]) / cell_size)
        _, first, inverse = np.unique(
            cells, axis=0, return_index=True, return_inverse=True
        )
        mesh = trimesh.Trimesh(
            vertices=mesh.vertices[first],
            faces=inverse[mesh.faces],
            process=False,
        )
        mesh.update_faces(mesh.unique_faces() & mesh.nondegenerate_faces())
        if len(mesh.faces) > max_faces:
            mesh = mesh.simplify_quadric_decimation(face_count=max_faces)
        if len(mesh.faces) > max_faces:
            raise ValueError(f"Unable to simplify mesh to {max_faces} faces")
    return mesh


def preserve_small_fragments(
    source: trimesh.Trimesh, simplified: trimesh.Trimesh, max_faces: int
) -> trimesh.Trimesh:
    """Retain detached source fragments when decimation shrinks the overall bounds."""
    if np.max(np.abs(source.bounds - simplified.bounds)) <= 0.05 * source.scale:
        return simplified
    labels = trimesh.graph.connected_component_labels(
        source.edges, len(source.vertices)
    )
    face_labels = labels[source.faces[:, 0]]
    sizes = np.bincount(face_labels)
    smallest = np.argsort(sizes)
    # Reserve at most half of the budget for unchanged fragments. Keep the
    # largest component in the decimator even for very small input meshes.
    ordered = smallest[:-1]
    keep = ordered[np.cumsum(sizes[ordered]) <= max_faces // 2]
    mask = np.isin(face_labels, keep)
    if not mask.any():
        return simplified
    fragments, main = cast(
        list[trimesh.Trimesh], source.submesh([mask, ~mask], repair=False)
    )
    reduced = simplify_to_budget(main, max_faces - len(fragments.faces))
    combined = trimesh.util.concatenate([reduced, fragments])
    if not isinstance(combined, trimesh.Trimesh):
        raise ValueError("Expected triangle mesh after combining fragments")
    return combined


def convert_one(
    entry: StructureDef,
    raw_dir: Path,
    meshes_dir: Path,
    *,
    max_faces: int,
    force: bool,
    prior: dict[str, Any] | None = None,
) -> dict[str, Any]:
    src = raw_dir / entry.source_filename
    out = meshes_dir / f"{entry.id}.glb"
    if out.exists() and not force:
        # Keep GLB-authoritative counts/bounds so a no-op rerun does not fall
        # back to pre-decimation STL inventory numbers in the manifest.
        try:
            stats = glb_geometry_stats(out)
        except Exception as exc:  # noqa: BLE001
            return {
                "id": entry.id,
                "status": "unreadable",
                "meshFile": f"meshes/{entry.id}.glb",
                "skipped": True,
                "bytes": out.stat().st_size,
                "error": f"existing GLB unreadable: {exc}",
            }
        if stats["triangleCount"] > max_faces and src.is_file():
            return convert_one(
                entry, raw_dir, meshes_dir, max_faces=max_faces, force=True
            )
        result: dict[str, Any] = {
            "id": entry.id,
            "status": "ok",
            "meshFile": f"meshes/{entry.id}.glb",
            "sourceFilename": entry.source_filename,
            "skipped": True,
            "bytes": out.stat().st_size,
            "triangleCount": stats["triangleCount"],
            "bounds": stats["bounds"],
            "sourceToDisplay": "identity",
            "error": None,
        }
        if prior:
            for key in (
                "sourceTriangleCount",
                "sourceBounds",
                "decimated",
                "maxFaces",
            ):
                if prior.get(key) is not None:
                    result[key] = prior[key]
        return result
    if not src.is_file():
        return {
            "id": entry.id,
            "status": "missing",
            "meshFile": None,
            "error": "source mesh missing",
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
            source_mesh = mesh
            mesh = simplify_to_budget(mesh, max_faces)
            mesh = preserve_small_fragments(source_mesh, mesh, max_faces)
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
