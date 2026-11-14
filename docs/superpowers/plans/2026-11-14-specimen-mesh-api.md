# Plan: Specimen mesh preparation and API

**Spec links:** §§2 (opens specimen / inspects named bone), §§4–5 (API + evidence), §7 (plans live here).  
**Roadmap:** Joshua track — archive → inventory → GLB → FastAPI handoff.  
**Status:** Implemented 2026-11-14 (21/21 Appendix 2 STLs → GLB; API + tests green).  
**Out of scope:** CT slices, Gemini, DB schema, uploads, frontend UI takeover.

## Goals

1. Verify Appendix 2, inventory every source STL with stable IDs, and record provenance/reuse.
2. Define a typed specimen JSON contract the frontend can load.
3. Convert usable STLs → per-structure GLBs without inventing anatomy or re-centering bones.
4. Serve specimen metadata + mesh assets from FastAPI with path-safe delivery.
5. Validate with tests; document Windows setup and handoffs.

## Architecture

```
data/raw/appendix2/Appendix2/*.stl   # source (gitignored)
data/prepared/ypm-vp-41198/
  manifest.json                      # inventory + conversion record
  meshes/{structure_id}.glb          # browser assets
backend/src/marrow/
  settings.py                        # ASSETS_DIR
  models/specimen.py                 # Pydantic response models
  specimens/                         # load manifest, resolve paths
  routes/specimens.py                # GET specimen + mesh
scripts/prepare_specimen.py          # inventory + convert CLI
docs/api/specimen-contract.md        # contract + example + FE notes
```

**Packaging choice:** one GLB per structure (node name = structure id). Matches “mesh URL when usable,” missing/unreadable status, and left/right identity better than a single multi-node scene.

**Coordinates:** preserve source STL vertex positions (identity transform). Frame labeled `source_stl`. Units and anatomical axis convention **unknown** until CT metadata is inspected (Appendix 1 deferred). Relative bone placement is preserved by not centering/scaling individuals.

## Increments

### 1. Inspect and inventory

- Recheck SHA-256 of `Appendix2.zip` vs published `bf221aa2…`.
- Extract to `data/raw/appendix2/` (ignored).
- Inventory all `.stl` files; map filename → `structure_id`, display name, side (`left`/`right`/`none`).
- Record triangle counts, AABB bounds, readability; note unknowns (units, orientation).
- Capture Dryad README terms (CC0-1.0), citation, credits from dataset metadata (API download of README may require auth — use landing-page README text + Dryad API license field).

### 2. Specimen contract

Response shape (sketch):

```json
{
  "id": "ypm-vp-41198",
  "scientificName": "Eosphorosuchus lacrimosa",
  "accession": "YPM VP 41198",
  "citation": { "...": "..." },
  "credits": ["..."],
  "reuseTerms": { "license": "CC0-1.0", "url": "..." },
  "coordinates": {
    "frame": "source_stl",
    "units": "unknown",
    "axisConvention": "unknown",
    "sourceToDisplay": "identity",
    "notes": "..."
  },
  "structures": [
    {
      "id": "maxilla_l",
      "name": "Maxilla",
      "side": "left",
      "sourceFilename": "maxillaL.stl",
      "status": "ok",
      "meshUrl": "/specimens/ypm-vp-41198/meshes/maxilla_l.glb"
    }
  ]
}
```

Document example + frontend integration in `docs/api/specimen-contract.md`.

### 3. Prepare browser assets

- Pilot 2–3 meshes (prefer mid-size readable ones, e.g. `nasalR`, `palatineR`, `jugalR`).
- Convert STL → GLB with trimesh; optional decimation only after measuring face counts/sizes.
- No per-bone centering/scaling; no brain cleanup / hole-fill heuristics.
- Validate exports; then batch remaining usable files (note: `quadrateL.stl` ~394 MB may need stronger simplification).
- CLI: `uv run python scripts/prepare_specimen.py …`

### 4. FastAPI

- `GET /specimens/{specimen_id}` → validated payload; 404 unknown.
- `GET /specimens/{specimen_id}/meshes/{structure_id}.glb` → FileResponse; 404 missing; reject path traversal.
- `ASSETS_DIR` / `assets_dir` in settings (default: repo `data/prepared`).
- Keep `/health`; no DB/Gemini required at startup.

### 5. Validate and hand off

- Tests: contract shape, OK mesh bytes, unavailable status, traversal rejection, unknown specimen.
- `pytest`, `ruff`, `pyright`.
- Browser GLB check if tooling allows; otherwise report sizes only.
- Docs: Windows prep commands, paths, API examples, coordinate notes, limitations.
- Atomic Conventional Commits per meaningful unit.

## Risks / unknowns

- Source units and axis convention not stated in Appendix 2 README.
- Mesh-to-CT registration not verified (out of scope).
- Very large STLs (`quadrateL`, `frontalL`) may need aggressive decimation for browser budgets.
- Dryad README binary download required bearer token; content taken from public landing page + license from Dryad API.
