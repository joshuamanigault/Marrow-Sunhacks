"""Direct-to-S3 uploads and durable publication of converted meshes."""

import json
import re
import shutil
import time
from contextlib import closing
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any
from uuid import uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException

from marrow.models.specimen import SpecimenListItem
from marrow.settings import get_settings
from marrow.specimens.upload_mesh import prepare_uploaded_mesh

UPLOAD_ID = re.compile(r"upload-[a-f0-9]{32}")
SOURCE_KEY = re.compile(r"incoming/(upload-[a-f0-9]{32})/source\.(stl|ply)")
MAX_BYTES = 100 * 1024 * 1024
_MISSING = {"404", "NoSuchKey", "NotFound"}


class UploadBucket:
    def __init__(self, name: str) -> None:
        self.name = name
        self.client: Any = boto3.client("s3", config=Config(signature_version="s3v4"))

    def initiate(self, filename: str, size: int) -> dict[str, Any]:
        job_id = f"upload-{uuid4().hex}"
        source = f"incoming/{job_id}/source{Path(filename).suffix.lower()}"
        self._write_json(
            f"jobs/{job_id}.json",
            {
                "filename": filename,
                "size": size,
                "created": time.time(),
            },
        )
        target = self.client.generate_presigned_post(
            Bucket=self.name,
            Key=source,
            Conditions=[["content-length-range", size, size]],
            ExpiresIn=900,
        )
        return {"id": job_id, **target}

    def _write_json(self, key: str, data: dict[str, Any], **options: Any) -> None:
        self.client.put_object(
            Bucket=self.name,
            Key=key,
            Body=json.dumps(data).encode(),
            ContentType="application/json",
            **options,
        )

    def _json(self, key: str) -> dict[str, Any] | None:
        try:
            obj = self.client.get_object(Bucket=self.name, Key=key)
        except ClientError as exc:
            if exc.response["Error"]["Code"] in _MISSING:
                return None
            raise
        with closing(obj["Body"]) as stream:
            return json.load(stream)

    def _manifest_key(self, job_id: str) -> str | None:
        if not UPLOAD_ID.fullmatch(job_id):
            return None
        page = self.client.list_objects_v2(
            Bucket=self.name,
            Prefix=f"manifests/{job_id}/",
            MaxKeys=1,
        )
        return next((obj["Key"] for obj in page.get("Contents", [])), None)

    def manifest(self, job_id: str) -> dict[str, Any] | None:
        key = self._manifest_key(job_id)
        return self._json(key) if key else None

    def catalog(self) -> list[SpecimenListItem]:
        # Each key carries the display filename; one LIST page covers up to 1,000
        # uploads without an additional S3 request per specimen.
        items = []
        pages = self.client.get_paginator("list_objects_v2").paginate(
            Bucket=self.name,
            Prefix="manifests/",
        )
        for page in pages:
            for obj in page.get("Contents", []):
                parts = obj["Key"].split("/")
                if len(parts) == 3 and UPLOAD_ID.fullmatch(parts[1]):
                    items.append(
                        SpecimenListItem(
                            id=parts[1],
                            accession=parts[1],
                            scientificName=Path(parts[2]).stem,
                            institution="User provided",
                            commonLabel="User-uploaded mesh",
                        )
                    )
        return items

    def status(self, job_id: str) -> dict[str, Any]:
        if self._manifest_key(job_id):
            return {"id": job_id, "status": "ready", "specimenId": job_id}
        job = self._json(f"jobs/{job_id}.json") if UPLOAD_ID.fullmatch(job_id) else None
        if job is None:
            raise HTTPException(404, "Unknown upload.")
        error = job.get("error")
        if not error and time.time() - job["created"] > 24 * 3600:
            error = "Conversion was interrupted. Please upload the file again."
        return {
            "id": job_id,
            "status": "failed" if error else "processing",
            "error": error,
        }

    def mesh_url(self, job_id: str) -> str:
        manifest = self.manifest(job_id)
        if not manifest:
            raise HTTPException(404, "Unknown uploaded mesh.")
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.name, "Key": manifest["meshKey"]},
            ExpiresIn=900,
        )

    def process(self, key: str, etag: str) -> None:
        match = SOURCE_KEY.fullmatch(key)
        if not match or not re.fullmatch(r"[a-fA-F0-9]{32}(?:-\d+)?", etag):
            raise ValueError("Invalid upload notification")
        job_id, extension = match.groups()
        job_key = f"jobs/{job_id}.json"
        job = self._json(job_key)
        mesh_key = f"meshes/{job_id}/{etag}.glb"
        published = self.manifest(job_id)
        if job and not job.get("error") and not published:
            try:
                source = self.client.get_object(
                    Bucket=self.name,
                    Key=key,
                    IfMatch=f'"{etag}"',
                )
            except ClientError as exc:
                # S3 can deliver duplicate or out-of-order object notifications.
                if exc.response["Error"]["Code"] in _MISSING | {"PreconditionFailed"}:
                    return
                raise
            with closing(source["Body"]) as stream, TemporaryDirectory() as temp:
                root = Path(temp)
                try:
                    if not 0 < source["ContentLength"] == job["size"] <= MAX_BYTES:
                        raise ValueError("Upload size mismatch")
                    with (root / f"source.{extension}").open("wb") as handle:
                        shutil.copyfileobj(stream, handle)
                    manifest = prepare_uploaded_mesh(
                        job_id, job["filename"], root, root
                    )
                except ValueError:
                    job["error"] = "Unable to convert this file. Choose a valid mesh."
                    self._write_json(job_key, job)
                else:
                    with (root / "meshes" / "uploaded_mesh.glb").open("rb") as glb:
                        self.client.put_object(
                            Bucket=self.name,
                            Key=mesh_key,
                            Body=glb,
                            ContentType="model/gltf-binary",
                        )
                    # Commit the manifest last. Concurrent deliveries cannot replace
                    # a published specimen or expose a partially uploaded mesh.
                    manifest["meshKey"] = mesh_key
                    try:
                        self._write_json(
                            f"manifests/{job_id}/{job['filename']}",
                            manifest,
                            IfNoneMatch="*",
                        )
                    except ClientError as exc:
                        if exc.response["Error"]["Code"] != "PreconditionFailed":
                            raise
                        published = self.manifest(job_id)
        # A replayed signed POST can carry different bytes. Keep only the GLB
        # referenced by the first committed manifest, including after a retry.
        if published and published["meshKey"] != mesh_key:
            self.client.delete_object(Bucket=self.name, Key=mesh_key)
        # A transient S3 failure before publication leaves the source for retry.
        try:
            self.client.delete_object(Bucket=self.name, Key=key, IfMatch=f'"{etag}"')
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in _MISSING | {"PreconditionFailed"}:
                raise


@lru_cache
def _bucket(name: str) -> UploadBucket:
    return UploadBucket(name)


def get_upload_bucket() -> UploadBucket | None:
    name = get_settings().upload_bucket
    return _bucket(name) if name else None
