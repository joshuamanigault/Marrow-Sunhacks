"""Bounded STL/PLY uploads and background conversion for a single API process."""

from __future__ import annotations

import json
import logging
import re
import shutil
from pathlib import Path
from threading import BoundedSemaphore
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from marrow.models.specimen import Citation, Coordinates, ReuseTerms, SpecimenResponse
from marrow.specimens.conversion import convert_one
from marrow.specimens.store import get_specimen_store
from marrow.structures import StructureDef

router = APIRouter(prefix="/uploads", tags=["uploads"])
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
_slots = BoundedSemaphore(2)
_active: set[str] = set()
logger = logging.getLogger(__name__)


class UploadStatus(BaseModel):
    id: str
    status: Literal["processing", "ready", "failed"]
    specimenId: str | None = None
    error: str | None = None


def _save_status(directory: Path, job: UploadStatus) -> None:
    temporary = directory / "status.tmp"
    temporary.write_text(job.model_dump_json(), encoding="utf-8")
    temporary.replace(directory / "status.json")


def _convert(directory: Path, assets: Path, filename: str) -> None:
    job = UploadStatus(id=directory.name, status="processing")
    staging = directory / "prepared"
    try:
        source_name = f"source{Path(filename).suffix.lower()}"
        entry = StructureDef("uploaded_mesh", Path(filename).stem, "none", source_name)
        result = convert_one(
            entry,
            directory / "raw",
            staging / "meshes",
            max_faces=80_000,
            force=True,
        )
        if result["status"] != "ok":
            raise ValueError("The file could not be read as a triangle mesh.")
        metadata = SpecimenResponse(
            id=job.id,
            scientificName=Path(filename).stem,
            commonLabel="User-uploaded mesh",
            accession=job.id,
            institution="User provided",
            citation=Citation(
                text="User-uploaded mesh; source not supplied.",
                datasetDoi="",
            ),
            credits=[],
            reuseTerms=ReuseTerms(
                license="Not specified",
                notes="No reuse license supplied.",
            ),
            coordinates=Coordinates(
                frame="source_ply"
                if filename.lower().endswith(".ply")
                else "source_stl",
                notes="Original coordinates preserved; units and orientation unknown.",
            ),
        )
        manifest = metadata.model_dump(mode="json")
        manifest["structures"] = [
            {
                **result,
                "sourceFilename": filename,
                "name": entry.name,
                "side": "none",
                "color": entry.color,
            }
        ]
        (staging / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        staging.rename(assets / job.id)
        job.status = "ready"
        job.specimenId = job.id
    except Exception:
        logger.exception("Mesh upload conversion failed: %s", job.id)
        job.status = "failed"
        job.error = (
            "Unable to convert this file. Choose a valid STL or PLY triangle mesh."
        )
        shutil.rmtree(staging, ignore_errors=True)
    finally:
        try:
            _save_status(directory, job)
        finally:
            _active.discard(job.id)
            _slots.release()


@router.post("", response_model=UploadStatus, status_code=202)
async def upload(
    request: Request,
    background_tasks: BackgroundTasks,
    filename: str,
) -> UploadStatus:
    # Raw body: no multipart parsing or whole-file buffering.
    if (
        not filename
        or len(filename) > 180
        or "/" in filename
        or "\\" in filename
        or any(ord(char) < 32 for char in filename)
        or Path(filename).suffix.lower() not in {".stl", ".ply"}
        or re.search(r'[<>:"|?*]', filename)
    ):
        raise HTTPException(400, "Choose an STL or PLY file with a plain filename.")
    if not _slots.acquire(blocking=False):
        raise HTTPException(429, "The converter is busy. Try again shortly.")
    assets = get_specimen_store().assets_dir
    directory = assets / ".uploads" / f"upload-{uuid4().hex}"
    queued = False
    try:
        raw = directory / "raw"
        raw.mkdir(parents=True)
        size = 0
        source_name = f"source{Path(filename).suffix.lower()}"
        with (raw / source_name).open("wb") as handle:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "Files must be 100 MB or smaller.")
                handle.write(chunk)
        if size == 0:
            raise HTTPException(400, "The file is empty.")
        job = UploadStatus(id=directory.name, status="processing")
        _save_status(directory, job)
        _active.add(job.id)
        background_tasks.add_task(_convert, directory, assets, filename)
        queued = True
        return job
    finally:
        if not queued:
            shutil.rmtree(directory, ignore_errors=True)
            _active.discard(directory.name)
            _slots.release()


@router.get("/{upload_id}", response_model=UploadStatus)
def status(upload_id: str) -> UploadStatus:
    if not re.fullmatch(r"upload-[a-f0-9]{32}", upload_id):
        raise HTTPException(404, "Unknown upload.")
    assets = get_specimen_store().assets_dir
    directory = assets / ".uploads" / upload_id
    path = directory / "status.json"
    if not path.is_file():
        raise HTTPException(404, "Unknown upload.")
    job = UploadStatus.model_validate_json(path.read_text(encoding="utf-8"))
    if job.status == "processing" and job.id not in _active:
        if (assets / job.id / "manifest.json").is_file():
            job.status = "ready"
            job.specimenId = job.id
        else:
            job.status = "failed"
            job.error = "Conversion was interrupted. Please upload the file again."
    return job
