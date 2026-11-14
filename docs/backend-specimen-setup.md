# Specimen assets — Windows setup

Advances spec §2 (open specimen / inspect named bone) via Joshua’s roadmap track.

## Prerequisites

- Python 3.13 + [uv](https://docs.astral.sh/uv/) (`%USERPROFILE%\.local\bin\uv.exe` on this machine)
- Appendix 2 zip (verified SHA-256):

```text
bf221aa2e981eb32f090926bee9f9e20b317608600add737f7917baed8d2cb7b  Appendix2.zip
```

## Prepare assets

```powershell
# From repo root
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"

# Extract (preserves originals; data/ is gitignored)
New-Item -ItemType Directory -Force -Path data\raw\appendix2 | Out-Null
Expand-Archive -Path "$env:USERPROFILE\Downloads\Appendix2.zip" -DestinationPath data\raw\appendix2 -Force

cd backend
uv sync

# Full pipeline: checksum optional, inventory, convert all, write manifest
# Parent flags (--archive) must come before the subcommand.
uv run python scripts/prepare_specimen.py --archive "$env:USERPROFILE\Downloads\Appendix2.zip" all --verify-archive

# Or pilot first:
uv run python scripts/prepare_specimen.py --archive "$env:USERPROFILE\Downloads\Appendix2.zip" inventory --verify-archive
uv run python scripts/prepare_specimen.py convert --ids nasal_r palatine_r jugal_r
uv run python scripts/prepare_specimen.py write-manifest
```

Outputs land in `data/prepared/ypm-vp-41198/`. Conversion settings: merge duplicate STL vertices; quadric decimate only when faces exceed **80 000**; **identity** transforms (no per-bone centering).

## Run API

```powershell
cd backend
# Optional: ASSETS_DIR=C:\path\to\data\prepared
uv run uvicorn marrow.main:app --reload --host 127.0.0.1 --port 8000
```

Examples:

```text
GET http://127.0.0.1:8000/health
GET http://127.0.0.1:8000/specimens
GET http://127.0.0.1:8000/specimens/ypm-vp-41198
GET http://127.0.0.1:8000/specimens/ypm-vp-41198/meshes/nasal_r.glb
```

## Checks

```powershell
cd backend
uv run pytest -q
uv run ruff check src tests scripts
uv run pyright
```

## Measured preparation results (2026-11-14)

- Appendix2.zip SHA-256 matched the published digest.
- Extracted **21/21** STLs listed in the Dryad README; all readable in trimesh.
- Prepared GLBs: **21 ok**, total **~23.57 MiB** (largest ~1.37 MiB, smallest ~0.34 MiB).
- Decimation cap: 80 000 faces; identity transforms; named GLB node = structure id.
- API smoke (real `ASSETS_DIR`): `/health`, specimen payload with 21 structures, GLB `glTF` magic bytes, 404 for unknown specimen/mesh.
- Browser visual / R3F load timing was **not** measured in this pass (frontend owner owns the viewer).

## Limitations

- Appendix 1 CT is out of scope; no mesh–volume alignment claim.
- Source units / axis convention unknown (see API `coordinates`).
- Dryad README binary download required auth; text captured from the public landing page + CC0 from Dryad API.
- Very large sources (e.g. `quadrateL.stl` ~394 MB / ~2 M faces) convert more slowly; browser cost depends on the decimated GLB sizes above.
