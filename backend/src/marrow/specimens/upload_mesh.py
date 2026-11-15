"""Prepare uploaded meshes with the same geometry and manifest in both stores."""

from pathlib import Path
from typing import Any

from marrow.models.specimen import Citation, Coordinates, ReuseTerms, SpecimenResponse
from marrow.specimens.conversion import convert_one
from marrow.structures import StructureDef


def prepare_uploaded_mesh(
    job_id: str, filename: str, raw_dir: Path, staging: Path
) -> dict[str, Any]:
    source_name = f"source{Path(filename).suffix.lower()}"
    entry = StructureDef("uploaded_mesh", Path(filename).stem, "none", source_name)
    result = convert_one(
        entry,
        raw_dir,
        staging / "meshes",
        max_faces=80_000,
        force=True,
    )
    if result["status"] != "ok":
        raise ValueError("The file could not be read as a triangle mesh.")
    metadata = SpecimenResponse(
        id=job_id,
        scientificName=Path(filename).stem,
        commonLabel="User-uploaded mesh",
        accession=job_id,
        institution="User provided",
        citation=Citation(
            text="User-uploaded mesh; source not supplied.",
            datasetDoi="",
        ),
        credits=[],
        reuseTerms=ReuseTerms(
            license="Not specified",
            notes="No reuse license supplied.",
        ),
        coordinates=Coordinates(
            frame="source_ply"
            if filename.lower().endswith(".ply")
            else "source_stl",
            notes="Original coordinates preserved; units and orientation unknown.",
        ),
    )
    manifest = metadata.model_dump(mode="json")
    manifest["structures"] = [
        {
            **result,
            "sourceFilename": filename,
            "name": entry.name,
            "side": "none",
            "color": entry.color,
        }
    ]
    return manifest
