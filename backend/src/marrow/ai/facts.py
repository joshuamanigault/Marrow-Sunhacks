"""Builds the numbered list of facts a prompt may use."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from marrow.models.ai import Fact
from marrow.models.specimen import SpecimenResponse, StructureSummary

log = logging.getLogger(__name__)

_FACTS_DIR = Path(__file__).resolve().parents[1] / "facts"
_SIDE = {"left": "left", "right": "right"}
_EMPTY: dict[str, Any] = {"specimen": [], "structures": {}}


@lru_cache
def _curated(specimen_id: str) -> dict[str, Any]:
    path = _FACTS_DIR / f"{specimen_id}.json"
    if not path.is_file():
        return _EMPTY
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        log.warning(
            "Ignoring unreadable curated facts for %s (%s): %s",
            specimen_id,
            path.name,
            exc,
        )
        return _EMPTY


def structure_label(s: StructureSummary) -> str:
    side = _SIDE.get(s.side)
    return f"{s.name} ({side})" if side else s.name


def _manifest_facts(
    specimen: SpecimenResponse, s: StructureSummary
) -> list[dict[str, Any]]:
    """What the dataset itself says about one bone: identity, never anatomy."""
    side = _SIDE.get(s.side)
    where = (
        f"the {side} side"
        if side
        else "the midline (no left/right pair in this dataset)"
    )
    return [
        {
            "text": f"This structure is the {s.name.lower()} from {where} of "
            f"{specimen.scientificName} specimen {specimen.accession}.",
            "source": "Specimen manifest",
            "url": str(specimen.citation.datasetUrl),
        },
        {
            "text": f"Its 3D model is the published mesh '{s.sourceFilename}' from "
            "Appendix 2 of the authors' Dryad dataset, segmented from the micro-CT "
            "scan.",
            "source": "Specimen manifest",
            "url": str(specimen.citation.datasetUrl),
        },
    ]


def _number(raw: list[dict[str, Any]], prefix: str) -> list[Fact]:
    return [
        Fact(
            id=f"{prefix}{i + 1}", text=f["text"], source=f["source"], url=f.get("url")
        )
        for i, f in enumerate(raw)
    ]


def specimen_facts(specimen: SpecimenResponse) -> list[Fact]:
    return _number(_curated(specimen.id).get("specimen", []), "S")


def structure_facts(specimen: SpecimenResponse, s: StructureSummary) -> list[Fact]:
    curated = _curated(specimen.id).get("structures", {}).get(s.id, [])
    return _number(_manifest_facts(specimen, s) + list(curated), f"{s.id}:")


def render(facts: list[Fact]) -> str:
    return "\n".join(f"[{f.id}] {f.text}" for f in facts)
