"""Specimen metadata and prepared mesh delivery."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from marrow.models.specimen import SpecimenResponse
from marrow.specimens.store import SpecimenStore, get_specimen_store

router = APIRouter(tags=["specimens"])


def _store() -> SpecimenStore:
    return get_specimen_store()


@router.get("/specimens/{specimen_id}", response_model=SpecimenResponse)
def get_specimen(specimen_id: str) -> SpecimenResponse:
    return _store().get_specimen(specimen_id)


@router.get("/specimens/{specimen_id}/meshes/{structure_id}.glb")
def get_structure_mesh(specimen_id: str, structure_id: str) -> FileResponse:
    path = _store().resolve_mesh(specimen_id, structure_id)
    return FileResponse(
        path,
        media_type="model/gltf-binary",
        filename=f"{structure_id}.glb",
        headers={"Cache-Control": "public, max-age=3600"},
    )
