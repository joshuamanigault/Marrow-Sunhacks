"""Specimen metadata and prepared mesh delivery."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

from marrow.models.specimen import SpecimenListItem, SpecimenResponse
from marrow.specimens.store import SpecimenStore, get_specimen_store
from marrow.specimens.upload_bucket import get_upload_bucket

router = APIRouter(tags=["specimens"])


def _store() -> SpecimenStore:
    return get_specimen_store()


@router.get("/specimens", response_model=list[SpecimenListItem])
def list_specimens() -> list[SpecimenListItem]:
    return _store().list_specimens()


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


@router.get("/uploads/{upload_id}/mesh")
def get_uploaded_mesh(upload_id: str) -> RedirectResponse:
    bucket = get_upload_bucket()
    if not bucket:
        raise HTTPException(404, "Unknown uploaded mesh.")
    return RedirectResponse(
        bucket.mesh_url(upload_id), headers={"Cache-Control": "no-store"}
    )
