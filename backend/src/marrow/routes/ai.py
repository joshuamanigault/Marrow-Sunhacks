"""Grounded Gemini features. All optional: without GEMINI_API_KEY they answer 503."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from marrow.ai import service
from marrow.ai.llm import JsonLLM, get_llm
from marrow.ai.rate_limit import enforce_ai_rate_limit
from marrow.models.ai import (
    AIStatus,
    ExplainRequest,
    ExplainResponse,
    FollowupRequest,
    FollowupResponse,
    TourRequest,
    TourResponse,
)
from marrow.specimens.store import get_specimen_store

router = APIRouter(prefix="/ai", tags=["ai"])

MaybeLLM = Annotated[JsonLLM | None, Depends(get_llm)]
_ai_rate_limit = Depends(enforce_ai_rate_limit)


def _require(llm: JsonLLM | None) -> JsonLLM:
    if llm is None:
        raise HTTPException(
            status_code=503, detail="AI features are off: no Gemini key on the server."
        )
    return llm


@router.get("/status", response_model=AIStatus)
def status(llm: MaybeLLM) -> AIStatus:
    return AIStatus(enabled=llm is not None, model=llm.model if llm else None)


@router.post(
    "/explain",
    response_model=ExplainResponse,
    dependencies=[_ai_rate_limit],
)
def explain(body: ExplainRequest, llm: MaybeLLM) -> ExplainResponse:
    ready = _require(llm)
    specimen = get_specimen_store().get_specimen(body.specimenId)
    return service.explain(ready, specimen, body.structureId, body.question)


@router.post(
    "/tour",
    response_model=TourResponse,
    dependencies=[_ai_rate_limit],
)
def tour(body: TourRequest, llm: MaybeLLM) -> TourResponse:
    ready = _require(llm)
    specimen = get_specimen_store().get_specimen(body.specimenId)
    return service.tour(ready, specimen, body.topic)


@router.post(
    "/followup",
    response_model=FollowupResponse,
    dependencies=[_ai_rate_limit],
)
def followup(body: FollowupRequest, llm: MaybeLLM) -> FollowupResponse:
    ready = _require(llm)
    specimen = get_specimen_store().get_specimen(body.specimenId)
    return service.followup(ready, specimen, body.structureId, body.note)
