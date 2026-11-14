"""Filesystem-backed specimen manifests and mesh path resolution."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from marrow.models.specimen import (
    Citation,
    Coordinates,
    ReuseTerms,
    SpecimenListItem,
    SpecimenResponse,
    StructureSummary,
)
from marrow.settings import Settings, get_settings

_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


class SpecimenStore:
    def __init__(self, assets_dir: Path) -> None:
        self.assets_dir = assets_dir.resolve()

    def specimen_dir(self, specimen_id: str) -> Path:
        self._check_id(specimen_id)
        path = (self.assets_dir / specimen_id).resolve()
        if not path.is_relative_to(self.assets_dir):
            raise HTTPException(status_code=400, detail="Invalid specimen id")
        return path

    def list_specimens(self) -> list[SpecimenListItem]:
        """Scan ASSETS_DIR for directories with a valid manifest.json."""
        if not self.assets_dir.is_dir():
            return []

        items: list[SpecimenListItem] = []
        for child in sorted(self.assets_dir.iterdir(), key=lambda p: p.name):
            if not child.is_dir():
                continue
            specimen_id = child.name
            if not _SAFE_ID.fullmatch(specimen_id):
                continue
            summary = self._list_item_from_manifest(
                child / "manifest.json", specimen_id
            )
            if summary is not None:
                items.append(summary)
        return items

    def load_manifest(self, specimen_id: str) -> dict[str, Any]:
        directory = self.specimen_dir(specimen_id)
        manifest_path = directory / "manifest.json"
        if not manifest_path.is_file():
            raise HTTPException(status_code=404, detail="Unknown specimen")
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500, detail="Specimen manifest is invalid"
            ) from exc
        if not isinstance(data, dict) or data.get("id") != specimen_id:
            raise HTTPException(
                status_code=500, detail="Specimen manifest is invalid"
            )
        return data

    def get_specimen(self, specimen_id: str) -> SpecimenResponse:
        data = self.load_manifest(specimen_id)
        structures: list[StructureSummary] = []
        for raw in data.get("structures", []):
            status = raw.get("status", "missing")
            structure_id = raw["id"]
            mesh_url = None
            if status == "ok":
                mesh_url = f"/specimens/{specimen_id}/meshes/{structure_id}.glb"
            structures.append(
                StructureSummary(
                    id=structure_id,
                    name=raw["name"],
                    side=raw["side"],
                    sourceFilename=raw["sourceFilename"],
                    status=status,
                    meshUrl=mesh_url,
                    triangleCount=raw.get("triangleCount"),
                    bounds=raw.get("bounds"),
                )
            )
        return SpecimenResponse(
            id=data["id"],
            scientificName=data["scientificName"],
            commonLabel=data.get("commonLabel", data["scientificName"]),
            accession=data["accession"],
            institution=data.get("institution", "Yale Peabody Museum"),
            citation=Citation.model_validate(data["citation"]),
            credits=list(data.get("credits", [])),
            reuseTerms=ReuseTerms.model_validate(data["reuseTerms"]),
            coordinates=Coordinates.model_validate(data["coordinates"]),
            structures=structures,
        )

    def resolve_mesh(self, specimen_id: str, structure_id: str) -> Path:
        self._check_id(specimen_id)
        self._check_id(structure_id)
        data = self.load_manifest(specimen_id)
        match = next(
            (s for s in data.get("structures", []) if s.get("id") == structure_id),
            None,
        )
        if match is None:
            raise HTTPException(status_code=404, detail="Unknown structure")
        if match.get("status") != "ok":
            raise HTTPException(
                status_code=404,
                detail=f"Structure asset unavailable ({match.get('status')})",
            )

        mesh_rel = match.get("meshFile") or f"meshes/{structure_id}.glb"
        if Path(mesh_rel).name != Path(mesh_rel).as_posix().split("/")[-1]:
            raise HTTPException(status_code=400, detail="Invalid mesh path")
        if ".." in Path(mesh_rel).parts or Path(mesh_rel).is_absolute():
            raise HTTPException(status_code=400, detail="Invalid mesh path")

        specimen_root = self.specimen_dir(specimen_id)
        path = (specimen_root / mesh_rel).resolve()
        if not path.is_relative_to(specimen_root):
            raise HTTPException(status_code=400, detail="Invalid mesh path")
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Mesh file not found")
        return path

    @staticmethod
    def _list_item_from_manifest(
        manifest_path: Path, specimen_id: str
    ) -> SpecimenListItem | None:
        if not manifest_path.is_file():
            return None
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            return None
        if not isinstance(data, dict) or data.get("id") != specimen_id:
            return None
        scientific_name = data.get("scientificName")
        accession = data.get("accession")
        if not isinstance(scientific_name, str) or not isinstance(accession, str):
            return None
        common_label = data.get("commonLabel", scientific_name)
        if not isinstance(common_label, str):
            common_label = scientific_name
        institution = data.get("institution")
        if institution is not None and not isinstance(institution, str):
            institution = None
        return SpecimenListItem(
            id=specimen_id,
            scientificName=scientific_name,
            accession=accession,
            commonLabel=common_label,
            institution=institution,
        )

    @staticmethod
    def _check_id(value: str) -> None:
        if not _SAFE_ID.fullmatch(value):
            raise HTTPException(status_code=400, detail="Invalid id")


@lru_cache
def get_specimen_store() -> SpecimenStore:
    settings: Settings = get_settings()
    return SpecimenStore(settings.assets_dir)
