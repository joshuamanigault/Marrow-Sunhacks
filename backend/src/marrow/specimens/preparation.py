"""Validated, per-specimen preparation settings, separate from prepared assets."""

from __future__ import annotations

import json
import re
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

from marrow.models.specimen import SpecimenResponse
from marrow.structures import Side, StructureDef

CATALOG_DIR = Path(__file__).with_name("catalog")
REPO_ROOT = Path(__file__).resolve().parents[4]
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def is_source_mesh(path: Path) -> bool:
    return path.suffix.lower() in {".stl", ".ply"} and all(
        part != "__MACOSX" and not part.startswith("._") for part in path.parts
    )


class SourceFile(BaseModel):
    filename: str
    fileId: int = Field(gt=0)
    size: int = Field(gt=0)
    digest: str
    digestType: str

    @model_validator(mode="after")
    def validate_file(self) -> SourceFile:
        if Path(self.filename).name != self.filename or "\\" in self.filename:
            raise ValueError("Source filename must be a basename")
        lengths = {"sha-256": 64, "md5": 32}
        if self.digestType not in lengths or not re.fullmatch(
            rf"[0-9a-f]{{{lengths[self.digestType]}}}", self.digest
        ):
            raise ValueError("Expected a published SHA-256 or MD5 checksum")
        return self


class PreparationStructure(BaseModel):
    id: str = Field(pattern=SAFE_ID.pattern)
    name: str
    side: Side = "none"
    sourceFilename: str

    def definition(self) -> StructureDef:
        source = Path(self.sourceFilename)
        if source.is_absolute() or ".." in source.parts or "\\" in self.sourceFilename:
            raise ValueError("Structure source must stay inside the raw directory")
        return StructureDef(self.id, self.name, self.side, self.sourceFilename)


class PreparationConfig(BaseModel):
    metadata: SpecimenResponse
    rawDir: str
    sourceFiles: list[SourceFile] = Field(default_factory=list)
    structures: list[PreparationStructure] = Field(default_factory=list)
    discoverStructures: bool = False

    @model_validator(mode="after")
    def validate_config(self) -> PreparationConfig:
        if not SAFE_ID.fullmatch(self.metadata.id):
            raise ValueError("Invalid specimen id")
        raw = (REPO_ROOT / self.rawDir).resolve()
        if not raw.is_relative_to(REPO_ROOT / "data" / "raw"):
            raise ValueError("rawDir must be inside data/raw")
        if not self.structures and not self.discoverStructures:
            raise ValueError("Specify structures or enable source-label discovery")
        ids = [s.id for s in self.structures]
        files = [s.sourceFilename for s in self.structures]
        if len(ids) != len(set(ids)) or len(files) != len(set(files)):
            raise ValueError("Structure ids and source filenames must be unique")
        for structure in self.structures:
            structure.definition()
        return self

    @property
    def raw_dir(self) -> Path:
        return REPO_ROOT / self.rawDir

    def structure_catalog(self, raw_dir: Path) -> dict[str, StructureDef]:
        if self.structures:
            return {s.sourceFilename: s.definition() for s in self.structures}
        # Preserve published file labels. Do not guess anatomy or sidedness.
        catalog: dict[str, StructureDef] = {}
        ids: set[str] = set()
        for path in sorted(raw_dir.rglob("*")):
            if not path.is_file() or not is_source_mesh(path.relative_to(raw_dir)):
                continue
            if not path.resolve().is_relative_to(raw_dir.resolve()):
                raise ValueError("Source mesh resolves outside raw directory")
            label = path.stem
            structure_id = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
            if not SAFE_ID.fullmatch(structure_id) or structure_id in ids:
                raise ValueError(
                    f"Supply explicit unique structure ids for {path.name}"
                )
            ids.add(structure_id)
            filename = path.relative_to(raw_dir).as_posix()
            catalog[filename] = StructureDef(structure_id, label, "none", filename)
        if not catalog:
            raise ValueError(f"No source meshes found in {raw_dir}")
        return catalog


def load_config(specimen_id: str) -> PreparationConfig:
    if not SAFE_ID.fullmatch(specimen_id):
        raise ValueError("Invalid specimen id")
    path = CATALOG_DIR / f"{specimen_id}.json"
    return PreparationConfig.model_validate(
        json.loads(path.read_text(encoding="utf-8"))
    )


def catalog_ids() -> list[str]:
    return sorted(path.stem for path in CATALOG_DIR.glob("*.json"))
