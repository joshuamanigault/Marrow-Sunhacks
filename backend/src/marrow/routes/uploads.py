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

from marrow.specimens.store import get_specimen_store
from marrow.specimens.upload_bucket import MAX_BYTES as MAX_UPLOAD_BYTES
from marrow.specimens.upload_bucket import get_upload_bucket
from marrow.specimens.upload_mesh import prepare_uploaded_mesh

router = APIRouter(prefix="/uploads", tags=["uploads"])
_slots = BoundedSemaphore(2)
_active: set[str] = set()
logger = logging.getLogger(__name__)


class UploadStatus(BaseModel):
    id: str
    status: Literal["processing", "ready", "failed"]
    specimenId: str | None = None
    error: str | None = None


class UploadRequest(BaseModel):
    filename: str
    size: int


class BucketUpload(BaseModel):
    mode: Literal["direct"] = "direct"
    id: str
    url: str
    fields: dict[str, str]


class LocalUpload(BaseModel):
    mode: Literal["local"] = "local"


def _save_status(directory: Path, job: UploadStatus) -> None:
    temporary = directory / "status.tmp"
    temporary.write_text(job.model_dump_json(), encoding="utf-8")
    temporary.replace(directory / "status.json")


def _convert(directory: Path, assets: Path, filename: str) -> None:
    job = UploadStatus(id=directory.name, status="processing")
    staging = directory / "prepared"
    try:
        manifest = prepare_uploaded_mesh(job.id, filename, directory / "raw", staging)
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
            try:
                shutil.rmtree(directory / "raw")
            except OSError:
                logger.exception("Unable to remove raw upload: %s", job.id)
            _save_status(directory, job)
        finally:
            _active.discard(job.id)
            _slots.release()


def _validate_filename(filename: str) -> None:
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


@router.post("/init")
def initiate_upload(upload: UploadRequest) -> BucketUpload | LocalUpload:
    _validate_filename(upload.filename)
    if upload.size <= 0:
        raise HTTPException(400, "The file is empty.")
    if upload.size > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Files must be 100 MB or smaller.")
    bucket = get_upload_bucket()
    if bucket is None:
        return LocalUpload()
    return BucketUpload.model_validate(bucket.initiate(upload.filename, upload.size))


@router.post("", response_model=UploadStatus, status_code=202)
async def upload(
    request: Request,
    background_tasks: BackgroundTasks,
    filename: str,
) -> UploadStatus:
    # Local installations stream the body without multipart or whole-file buffering.
    _validate_filename(filename)
    if get_upload_bucket() is not None:
        raise HTTPException(400, "Start a direct upload with POST /uploads/init.")
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
    bucket = get_upload_bucket()
    if bucket is not None:
        return UploadStatus.model_validate(bucket.status(upload_id))
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
