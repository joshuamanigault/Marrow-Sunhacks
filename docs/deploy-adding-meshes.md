# Adding meshes to the live site

How to get new bone meshes (or a whole new specimen) from source STL files onto
the live site at https://d2jpmtnbpeindq.cloudfront.net.

## How meshes reach the site today

```
STL files ──prepare_specimen.py──▶ data/prepared/<specimen-id>/
                                     manifest.json + meshes/*.glb
                                          │  copied into the API image
                                          ▼  (backend/Dockerfile)
          ECR image marrow-api:latest ──▶ Lambda marrow-api
                                          │
 Browser ──▶ CloudFront ── /specimens*, /health, /ai* ──▶ Lambda (Function URL)
                       └── everything else ─────────────▶ S3 bucket (frontend)
```

- **Meshes live inside the API container image.** `data/prepared/` is gitignored, so
  the image must be built on a machine that has run the prepare step.
- The viewer asks the API for `GET /specimens/<id>`, then loads each structure's
  `meshUrl` (`/specimens/<id>/meshes/<structure_id>.glb`) through CloudFront.
- CloudFront caches meshes (`/specimens/*/meshes/*`, CachingOptimized). It does
  not cache `/specimens*` JSON, `/health` or `/ai*`.

| Thing | Value |
| --- | --- |
| AWS region | `us-east-1` |
| ECR repository | `672666410834.dkr.ecr.us-east-1.amazonaws.com/marrow-api` |
| Lambda function | `marrow-api` |
| CloudFront distribution | `E10TU2IOR5N8GD` (`d2jpmtnbpeindq.cloudfront.net`) |
| Frontend bucket | `marrow-web-672666410834` |

## Before you start

- Docker Desktop running.
- AWS CLI signed in to the account above. Check: `aws sts get-caller-identity`.
- Backend set up per [backend-specimen-setup.md](backend-specimen-setup.md)
  (uv, Python 3.13).
- The source STL files and their licence. Only add data whose terms allow
  public display, and record the citation and credits (spec §5).

All commands below are PowerShell from the repo root.

---

## Case A: more bones for the current specimen (YPM VP 41198)

This is the supported path. The pipeline is built around one curated specimen.

1. **Put the STL files** in `data/raw/appendix2/Appendix2/` next to the existing ones.
2. **Register each file** in `STRUCTURE_CATALOG` in
   `backend/src/marrow/structures.py`. The key is the exact file name; the
   `StructureDef` gives a stable id (lowercase, `_l`/`_r` for sides), the display
   name, the side (`left`, `right` or `none`) and the file name again:
   ```python
   "squamosalR.stl": StructureDef("squamosal_r", "Squamosal", "right", "squamosalR.stl"),
   ```
   Files not in the catalog are reported by the inventory step but never converted.
3. **Convert and rebuild the manifest.** `-X utf8` avoids a Windows crash when
   the script's output is piped:
   ```powershell
   cd backend
   uv run python -X utf8 scripts/prepare_specimen.py all
   cd ..
   ```
   Check `data/prepared/ypm-vp-41198/conversion-log.json`: every new structure
   should be `ok`. Unreadable files are kept in the manifest as `unreadable` and
   shown as such in the app. They are never replaced with anything invented.
4. **Test locally:** start the API (`uv run uvicorn marrow.main:app --reload` in
   `backend/`) and the frontend, open the workspace, and confirm the new bones
   appear in the structure list and the 3D scene.
5. **Deploy:** follow "Deploying new mesh data" below.
6. **Optional: the landing page skull.** `frontend/public/skull.glb` is a separate,
   simplified copy for the landing hero and Explore card. It won't include new
   bones until it's rebuilt; the commands are in the comment at the top of
   `frontend/src/Skull.tsx`. Rebuilding it needs a frontend redeploy (steps 4–5
   below).

## Case B: a new specimen

Not supported by the pipeline yet; it needs code changes first. The specimen id
(`SPECIMEN_ID` in `structures.py`), the structure catalog, and the identity
block (scientific name, accession, citation, credits, reuse terms) in
`prepare_specimen.py` are all hard-coded for YPM VP 41198.

What has to change, roughly:

1. Give the prepare script a per-specimen config (id, identity block, structure
   catalog, raw folder) instead of module constants. Output goes to
   `data/prepared/<new-id>/` with its own `manifest.json`.
2. The API needs no change: `GET /specimens` already lists every folder in
   `ASSETS_DIR` that has a valid `manifest.json`.
3. Frontend: the Explore catalog and the landing page specimen are hard-coded in
   `frontend/src/Landing.tsx` (`curated`, `catalog`). Switch Explore to
   `GET /specimens` or add an entry by hand.
4. AI: add a facts file `backend/src/marrow/facts/<new-id>.json`, or the Ask
   panel has only manifest facts to work from.

Agree on this with the backend owner before starting. It touches the API contract
in `docs/api/specimen-contract.md`.

---

## Deploying new mesh data

The meshes ship inside the API image, so new meshes mean a new image.

1. **Build** (from the repo root, with `data/prepared/` present). Keep
   `--provenance=false`; Lambda rejects images with build attestations.
   ```powershell
   docker build --platform linux/amd64 --provenance=false -f backend/Dockerfile -t marrow-api .
   ```
2. **Smoke test** the image locally:
   ```powershell
   docker run --rm -d --name marrow-test -p 8001:8000 marrow-api
   curl.exe http://localhost:8001/specimens/ypm-vp-41198
   docker rm -f marrow-test
   ```
   The JSON should list the new structures with `"status":"ok"` and a `meshUrl`.
3. **Push to ECR:**
   ```powershell
   $REGISTRY = "672666410834.dkr.ecr.us-east-1.amazonaws.com"
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $REGISTRY
   docker tag marrow-api:latest "$REGISTRY/marrow-api:latest"
   docker push "$REGISTRY/marrow-api:latest"
   ```
4. **Point the Lambda at the new image.** Pushing alone does not redeploy it.
   ```powershell
   aws lambda update-function-code --function-name marrow-api --image-uri "$REGISTRY/marrow-api:latest" --region us-east-1
   aws lambda wait function-updated --function-name marrow-api --region us-east-1
   ```
5. **Clear CloudFront's cached API and meshes**, so visitors get the new manifest
   and any re-converted meshes:
   ```powershell
   aws cloudfront create-invalidation --distribution-id E10TU2IOR5N8GD --paths "/specimens*"
   ```
6. **Only if you changed the frontend** (Explore catalog, `skull.glb`, etc.):
   ```powershell
   npm --prefix frontend run build
   aws s3 sync frontend/dist/assets s3://marrow-web-672666410834/assets --cache-control "public,max-age=31536000,immutable"
   aws s3 sync frontend/dist s3://marrow-web-672666410834 --exclude "assets/*" --cache-control "public,max-age=300"
   aws s3 cp frontend/dist/index.html s3://marrow-web-672666410834/index.html --cache-control "no-cache"
   aws cloudfront create-invalidation --distribution-id E10TU2IOR5N8GD --paths "/*"
   ```
   `frontend/.env.production` must contain
   `VITE_API_BASE_URL=https://d2jpmtnbpeindq.cloudfront.net` (it's gitignored,
   so create it if it's missing).

## Check it

- `https://d2jpmtnbpeindq.cloudfront.net/specimens/ypm-vp-41198` lists the new
  structures.
- `https://d2jpmtnbpeindq.cloudfront.net/specimens/ypm-vp-41198/meshes/<new_id>.glb`
  downloads a GLB.
- The workspace shows the new bones in the list and in the 3D scene. Open the
  browser's network tab: every `.glb` should be 200.

## Known limits

- **Lambda concurrency is 10 on this account.** The viewer requests every mesh at
  once, so with more than about 10 meshes some can come back `429 Too Many
  Requests` on a first visit, and that bone is missing until a reload. CloudFront
  caches each mesh after its first success, so it improves over time, but not
  for every visitor. More meshes make this worse. The fix is to serve meshes from
  S3: upload `data/prepared/<id>/meshes/*.glb` to
  `s3://marrow-web-672666410834/specimens/<id>/meshes/` and point CloudFront's
  `/specimens/*/meshes/*` route at the S3 origin. The mesh URLs stay the same,
  so no code changes. Another option is asking AWS to raise the concurrency
  limit.
- **Image size vs free ECR storage (500 MB).** The image is about 300 MB
  compressed, and every push leaves the previous image behind untagged. Delete
  old untagged images in the ECR console (Repositories → `marrow-api`) when
  you're done, or set a lifecycle rule that expires untagged images.
- **Mesh size.** The prepare step caps each mesh at 80,000 triangles (about
  1.4 MB). Keep it that way: Lambda responses max out at 6 MB, and every mesh
  loads on every workspace visit.
