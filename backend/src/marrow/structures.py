"""Stable structure catalog for YPM VP 41198 Appendix 2 meshes.

IDs are derived from source filenames so left/right elements stay distinct.
Display names are grounded in the Dryad README element names.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Side = Literal["left", "right", "none"]


@dataclass(frozen=True, slots=True)
class StructureDef:
    id: str
    name: str
    side: Side
    source_filename: str


# Filename → catalog entry. Keys match Appendix 2 STL basenames.
STRUCTURE_CATALOG: dict[str, StructureDef] = {
    "angularL.stl": StructureDef("angular_l", "Angular", "left", "angularL.stl"),
    "ectopterygoidL.stl": StructureDef(
        "ectopterygoid_l", "Ectopterygoid", "left", "ectopterygoidL.stl"
    ),
    "ectopterygoidR.stl": StructureDef(
        "ectopterygoid_r", "Ectopterygoid", "right", "ectopterygoidR.stl"
    ),
    "frontalL.stl": StructureDef("frontal_l", "Frontal", "left", "frontalL.stl"),
    "frontalR.stl": StructureDef("frontal_r", "Frontal", "right", "frontalR.stl"),
    "jugalR.stl": StructureDef("jugal_r", "Jugal", "right", "jugalR.stl"),
    "lacrimalR.stl": StructureDef("lacrimal_r", "Lacrimal", "right", "lacrimalR.stl"),
    "maxillaL.stl": StructureDef("maxilla_l", "Maxilla", "left", "maxillaL.stl"),
    "maxillaR.stl": StructureDef("maxilla_r", "Maxilla", "right", "maxillaR.stl"),
    "nasalR.stl": StructureDef("nasal_r", "Nasal", "right", "nasalR.stl"),
    "palatineR.stl": StructureDef(
        "palatine_r", "Palatine", "right", "palatineR.stl"
    ),
    "palpebralR.stl": StructureDef(
        "palpebral_r", "Palpebral", "right", "palpebralR.stl"
    ),
    "postorbitalR.stl": StructureDef(
        "postorbital_r", "Postorbital", "right", "postorbitalR.stl"
    ),
    "prefrontalR.stl": StructureDef(
        "prefrontal_r", "Prefrontal", "right", "prefrontalR.stl"
    ),
    "premaxillaR.stl": StructureDef(
        "premaxilla_r", "Premaxilla", "right", "premaxillaR.stl"
    ),
    "pterygoidL.stl": StructureDef(
        "pterygoid_l", "Pterygoid", "left", "pterygoidL.stl"
    ),
    "pterygoidR.stl": StructureDef(
        "pterygoid_r", "Pterygoid", "right", "pterygoidR.stl"
    ),
    "quadrateL.stl": StructureDef(
        "quadrate_l", "Quadrate", "left", "quadrateL.stl"
    ),
    "quadrateR.stl": StructureDef(
        "quadrate_r", "Quadrate", "right", "quadrateR.stl"
    ),
    "surangularL.stl": StructureDef(
        "surangular_l", "Surangular", "left", "surangularL.stl"
    ),
    "vomers.stl": StructureDef("vomers", "Vomers", "none", "vomers.stl"),
}

SPECIMEN_ID = "ypm-vp-41198"


def structure_by_id(structure_id: str) -> StructureDef | None:
    for entry in STRUCTURE_CATALOG.values():
        if entry.id == structure_id:
            return entry
    return None
