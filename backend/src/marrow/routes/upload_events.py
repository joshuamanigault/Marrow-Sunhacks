"""S3 notifications delivered only to the dedicated conversion Lambda."""

from typing import Any
from urllib.parse import unquote_plus

from fastapi import APIRouter, HTTPException

from marrow.specimens.upload_bucket import get_upload_bucket

# The Lambda Web Adapter can forward a non-HTTP event without a Content-Type.
router = APIRouter(strict_content_type=False)


@router.post("/events")
def convert_event(event: dict[str, Any]) -> dict[str, str]:
    bucket = get_upload_bucket()
    if not bucket:
        raise RuntimeError("UPLOAD_BUCKET is required for the upload worker")
    if event.get("Event") == "s3:TestEvent":
        return {"status": "ok"}
    for record in event["Records"]:
        source = record["s3"]
        if source["bucket"]["name"] != bucket.name:
            raise HTTPException(400, "Unexpected upload bucket.")
        obj = source["object"]
        bucket.process(unquote_plus(obj["key"]), obj["eTag"])
    return {"status": "ok"}
