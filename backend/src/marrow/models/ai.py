"""Request / response shapes for the grounded AI features (spec §6 Gemini)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from marrow.models.specimen import Citation


class Fact(BaseModel):
    """One grounded statement the model was allowed to use."""

    id: str
    text: str
    source: str
    url: str | None = None


class AIStatus(BaseModel):
    enabled: bool
    model: str | None = None


# ---- explain -------------------------------------------------------------


class ExplainRequest(BaseModel):
    specimenId: str
    structureId: str
    question: str | None = Field(default=None, max_length=300)


class ExplainResponse(BaseModel):
    answer: str
    #: False when the facts did not cover the question.
    covered: bool
    facts: list[Fact]
    citation: Citation
    aiGenerated: Literal[True] = True


# ---- guided tour ---------------------------------------------------------


class TourRequest(BaseModel):
    specimenId: str
    topic: str = Field(min_length=1, max_length=200)


class TourStep(BaseModel):
    structureId: str
    caption: str
    facts: list[Fact]


class TourResponse(BaseModel):
    title: str
    steps: list[TourStep]
    citation: Citation
    aiGenerated: Literal[True] = True


# ---- observation helper --------------------------------------------------


class FollowupRequest(BaseModel):
    specimenId: str
    structureId: str
    note: str = Field(min_length=1, max_length=500)


class FollowupResponse(BaseModel):
    question: str
    facts: list[Fact]
    citation: Citation
    aiGenerated: Literal[True] = True


# ---- what the model must return (structured output) ----------------------


class ExplainDraft(BaseModel):
    answer: str
    usedFactIds: list[str]
    covered: bool


class TourStepDraft(BaseModel):
    structureId: str
    caption: str
    usedFactIds: list[str]


class TourDraft(BaseModel):
    title: str
    steps: list[TourStepDraft]


class FollowupDraft(BaseModel):
    question: str
    usedFactIds: list[str]
