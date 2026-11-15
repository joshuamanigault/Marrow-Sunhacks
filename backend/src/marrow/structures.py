"""Stable structure catalog for YPM VP 41198 Appendix 2 meshes.

IDs are derived from source filenames so left/right elements stay distinct.
Display names are grounded in the Dryad README element names.

Display colors: each structure id maps to a deterministic ``#rrggbb`` via
``color_for_structure_id``. Left/right of the same bone name get **distinct**
colors because their ids differ (e.g. ``maxilla_l`` vs ``maxilla_r``). The
same id always yields the same hex across runs and processes.
"""

from __future__ import annotations

import colorsys
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Side = Literal["left", "right", "none"]

# Namespace so casual hex hashes of bare ids do not collide with our palette.
_COLOR_NAMESPACE = "marrow:structure-color:v1:"


def color_for_structure_id(structure_id: str) -> str:
    """Return a stable ``#rrggbb`` display color for a structure id.

    Hue and a small lightness offset come from SHA-256 of the namespaced id so
    the mapping does not drift when the catalog gains or reorders entries.
    Saturation/lightness stay in a muted band readable on the ivory canvas.
    """
    digest = hashlib.sha256(f"{_COLOR_NAMESPACE}{structure_id}".encode()).digest()
    hue = int.from_bytes(digest[:2], "big") / 65535.0
    lightness = 0.52 + (digest[2] / 255.0) * 0.12
    saturation = 0.40
    red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
    return f"#{int(red * 255):02x}{int(green * 255):02x}{int(blue * 255):02x}"


@dataclass(frozen=True, slots=True)
class StructureDef:
    id: str
    name: str
    side: Side
    source_filename: str

    @property
    def color(self) -> str:
        return color_for_structure_id(self.id)


SPECIMEN_ID = "ypm-vp-41198"

# Keep the legacy helpers and prepare CLI on the same per-specimen source of truth.
_CONFIG_PATH = Path(__file__).parent / "specimens" / "catalog" / f"{SPECIMEN_ID}.json"
_CONFIG = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
STRUCTURE_CATALOG: dict[str, StructureDef] = {
    row["sourceFilename"]: StructureDef(
        row["id"], row["name"], row["side"], row["sourceFilename"]
    )
    for row in _CONFIG["structures"]
}


def structure_by_id(structure_id: str) -> StructureDef | None:
    for entry in STRUCTURE_CATALOG.values():
        if entry.id == structure_id:
            return entry
    return None
