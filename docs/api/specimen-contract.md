# Specimen API contract

**Spec:** §§2, 4–5 — open curated specimen; inspect named bones with stable identity.  
**Plan:** [docs/superpowers/plans/2026-11-14-specimen-mesh-api.md](../superpowers/plans/2026-11-14-specimen-mesh-api.md)

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/health` | `{"status":"ok"}` |
| `GET` | `/specimens/{specimen_id}` | Specimen metadata + structures |
| `GET` | `/specimens/{specimen_id}/meshes/{structure_id}.glb` | Binary GLB |

Curated MVP id: **`ypm-vp-41198`**.

Unknown specimen → **404**. Unknown / unavailable mesh → **404**. Invalid ids / path tricks → **400**.

## Example response

```json
{
  "id": "ypm-vp-41198",
  "scientificName": "Eosphorosuchus lacrimosa",
  "commonLabel": "Eosphorosuchus lacrimosa",
  "accession": "YPM VP 41198",
  "institution": "Yale Peabody Museum",
  "citation": {
    "text": "Margulis-Ohnuma, M., Ruebenstahl, A., Meyer, D., & Bhullar, B.-A. (2026). Data for: A short-snouted \"sphenosuchian\" with unusual feeding anatomy demonstrates that ecological specialization occurred early in crocodylomorph evolution. Dryad. https://doi.org/10.5061/dryad.q83bk3jvv",
    "datasetDoi": "10.5061/dryad.q83bk3jvv",
    "datasetUrl": "https://doi.org/10.5061/dryad.q83bk3jvv",
    "articleDoi": "10.1098/rspb.2026.0130",
    "articleUrl": "https://doi.org/10.1098/rspb.2026.0130"
  },
  "credits": [
    "Miranda Margulis-Ohnuma",
    "Alexander Ruebenstahl",
    "Dalton Meyer",
    "Bhart-Anjan Bhullar"
  ],
  "reuseTerms": {
    "license": "CC0-1.0",
    "licenseUrl": "https://spdx.org/licenses/CC0-1.0.html",
    "notes": "Dryad reports CC0-1.0. Retain specimen identity, researcher credits, and dataset DOI in the application."
  },
  "coordinates": {
    "frame": "source_stl",
    "units": "unknown",
    "axisConvention": "unknown",
    "sourceToDisplay": "identity",
    "notes": "Vertices are the Appendix 2 STL positions with an identity node transform. Relative placement across bones is preserved by not centering or scaling individuals. Units and anatomical axis convention are not stated in the Appendix 2 README; CT scan metadata (Appendix 1) was not inspected for this mesh pipeline."
  },
  "structures": [
    {
      "id": "maxilla_l",
      "name": "Maxilla",
      "side": "left",
      "sourceFilename": "maxillaL.stl",
      "status": "ok",
      "meshUrl": "/specimens/ypm-vp-41198/meshes/maxilla_l.glb",
      "triangleCount": 80000,
      "bounds": {
        "min": [-22.67, 6.15, -5.43],
        "max": [32.14, 90.54, 21.15]
      }
    },
    {
      "id": "maxilla_r",
      "name": "Maxilla",
      "side": "right",
      "sourceFilename": "maxillaR.stl",
      "status": "ok",
      "meshUrl": "/specimens/ypm-vp-41198/meshes/maxilla_r.glb",
      "triangleCount": 80000,
      "bounds": {
        "min": [2.06, -3.39, 0.30],
        "max": [78.28, 44.31, 34.71]
      }
    }
  ]
}
```

`status` is one of: `ok` | `missing` | `unreadable`. Only `ok` structures include `meshUrl`.

Left and right elements share a display `name` but always have distinct `id` values (`maxilla_l` vs `maxilla_r`).

## Coordinates (frontend)

- Mesh vertices are already in **specimen / source STL space**.
- Backend applies **no** per-bone centering, scaling, or axis flip (`sourceToDisplay: "identity"`).
- Store pins and explode offsets relative to this frame (and bone id), not screen pixels or exploded world pose.
- Units are **unknown** (likely millimetres from micro-CT, unverified). Do not hard-code a millimetre UI claim until Appendix 1 metadata is checked.
- Axis convention is **unknown** — not RAS. Do not reuse Lobe’s MRI −90° X assumption unless you verify it visually for this specimen.

## Frontend integration notes

1. `GET /specimens/ypm-vp-41198` once on open.
2. For each structure with `status === "ok"`, `useGLTF` / `GLTFLoader` on `meshUrl` (prefix with `VITE_API_URL`).
3. Keep `structure.id` on the Three object / store key — never key solely by display name.
4. Surface `missing` / `unreadable` rows honestly; do not substitute illustrations.
5. At explode separation `0`, meshes should sit in authored positions because assets were not individually recentered.
6. GLB node name equals `structure.id` (single mesh per file).

## Asset layout (local)

```text
data/prepared/ypm-vp-41198/
  manifest.json
  inventory.json
  conversion-log.json
  meshes/{structure_id}.glb
```

Configure with `ASSETS_DIR` (defaults to `<repo>/data/prepared`). Binaries stay gitignored.
