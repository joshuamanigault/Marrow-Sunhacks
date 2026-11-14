"""Typed specimen API contract (spec §§2, 5; frontend handoff)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

StructureStatus = Literal["ok", "missing", "unreadable"]
Side = Literal["left", "right", "none"]


class Citation(BaseModel):
    text: str
    datasetDoi: str
    datasetUrl: HttpUrl
    articleDoi: str | None = None
    articleUrl: HttpUrl | None = None


class ReuseTerms(BaseModel):
    license: str
    licenseUrl: HttpUrl
    notes: str


class Coordinates(BaseModel):
    """How mesh vertices relate to display / pin space.

    Source STL vertices are served unchanged (identity transform). Units and
    anatomical axis convention are not stated in Appendix 2; treat as unknown
    until CT metadata is inspected.
    """

    frame: Literal["source_stl"] = "source_stl"
    units: Literal["unknown", "mm"] = "unknown"
    axisConvention: Literal["unknown"] = "unknown"
    sourceToDisplay: Literal["identity"] = "identity"
    notes: str


class StructureSummary(BaseModel):
    id: str
    name: str
    side: Side
    sourceFilename: str
    status: StructureStatus
    meshUrl: str | None = None
    triangleCount: int | None = None
    bounds: dict[str, list[float]] | None = None


class SpecimenListItem(BaseModel):
    """Compact catalog row: enough to open a curated specimen."""

    id: str
    scientificName: str
    accession: str
    commonLabel: str
    institution: str | None = None


class SpecimenResponse(BaseModel):
    id: str
    scientificName: str
    commonLabel: str
    accession: str
    institution: str
    citation: Citation
    credits: list[str]
    reuseTerms: ReuseTerms
    coordinates: Coordinates
    structures: list[StructureSummary] = Field(default_factory=list)
