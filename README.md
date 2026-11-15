# Marrow

**Marrow turns real fossil CT studies into an interactive 3D learning workspace in the browser.**

A visitor opens a curated specimen, inspects named bones, switches Solid / X-ray / Exploded views, pins local observations, and—optionally—asks grounded questions about anatomy. No install, no account, and no invented bones: what you see maps to prepared meshes from a published study.

**Live demo:** [https://d2jpmtnbpeindq.cloudfront.net/](https://d2jpmtnbpeindq.cloudfront.net/)  
**Featured specimen:** *Eosphorosuchus lacrimosa* · Yale Peabody Museum **YPM VP 41198** ([Dryad, CC0-1.0](https://datadryad.org/dataset/doi%3A10.5061/dryad.q83bk3jvv))

Built at [sunhacks](https://www.mlh.com/events/sunhacks-ec) by Alexandra, Alex, Joshua, and Ananya.

---

## What you can do

| Experience | What it means |
| --- | --- |
| **Explore a real specimen** | Landing → Explore → workspace loads animal, accession, institution, citation, and researcher credits |
| **Inspect named bones** | Rotate, select, hide, focus; left vs right structures stay distinct |
| **Look behind overlap** | Solid / X-ray opacity styles, explode + separation, Reset restores camera and display |
| **Pin observations** | Notes stick to bone-space points, survive explode/reset, and restore in the same browser only |
| **Ask (optional Gemini)** | Ask about a bone, take a guided tour, or get a follow-up on a note—answers are labelled AI-generated and cite server-side facts only |
| **Hand control (optional)** | Webcam gestures drive the same viewer state; MediaPipe runs in-browser; video never leaves the machine |
| **Upload path** | Contributors can submit meshes through the upload flow (see deploy docs) |

Honesty rule: missing or unreadable meshes are marked as such. We do not substitute illustrations or invent anatomy.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Three Fiber / Three.js, Zustand, MediaPipe Hands |
| Backend | Python 3.13, FastAPI, Uvicorn, Pydantic Settings, trimesh |
| AI | Gemini via FastAPI only (`GEMINI_API_KEY` server-side; browser never sees the key) |
| Assets | Prepared GLBs + manifests under `data/prepared/` (gitignored binaries) |
| Tooling | npm (frontend), uv (backend), pytest / ruff / pyright, oxlint |

Product source of truth: [`docs/spec.md`](docs/spec.md).

---

## Repository layout

```text
frontend/          React workspace, landing, explore, upload, 3D viewer
backend/           FastAPI: specimens, AI, uploads
data/              Raw + prepared specimen assets (local; not committed)
docs/              Spec, roadmap, demo script, API contracts, setup guides
```

---

## Quick start (local)

**Prerequisites:** Node.js 22+, Python 3.13, [uv](https://docs.astral.sh/uv/). Windows works without Docker/WSL.

### 1. Backend

```powershell
cd backend
copy .env.example .env
uv sync
uv run uvicorn marrow.main:app --reload --host 127.0.0.1 --port 8000
```

Prepared meshes default to `data/prepared/`. To rebuild from the Dryad Appendix 2 archive, see [`docs/backend-specimen-setup.md`](docs/backend-specimen-setup.md).

Optional Gemini (Ask panel):

```text
# backend/.env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=                 # blank → gemini-3.5-flash-lite
```

Details: [`docs/handoff-gemini-setup.md`](docs/handoff-gemini-setup.md), [`docs/api/ai-contract.md`](docs/api/ai-contract.md).

### 2. Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) or go straight to the featured workspace:

[http://localhost:5173/workspace/ypm-vp-41198](http://localhost:5173/workspace/ypm-vp-41198)

`VITE_API_BASE_URL` must point at the API (default `http://127.0.0.1:8000`).

### 3. Checks

```powershell
# backend
cd backend
uv run pytest -q
uv run ruff check src tests scripts
uv run pyright

# frontend
cd frontend
npm run typecheck
npm run lint
```

Judge click-order checklist: [`docs/demo-script.md`](docs/demo-script.md).

---

## How we use Cursor and Grok Bot

Marrow was built with **Cursor as our core AI coding agent** and a **Grok Bot automation** in the PR workflow—both required for the SpaceXSI “Make it Legendary” track at sunhacks.

### Cursor — day-to-day build agent

We use Cursor agents throughout the repo to ship features against the product spec:

- **Spec-driven work** — Agents read [`docs/spec.md`](docs/spec.md) and name the §2 outcome a task advances before coding.
- **Implementation plans** — Feature designs live under [`docs/superpowers/`](docs/superpowers/README.md) and link back to the spec.
- **Full-stack iteration** — Specimen preparation scripts, FastAPI contracts, React Three Fiber viewer state, Gemini Ask panel, hand gestures, landing/explore, and deploy notes were developed in Cursor agent sessions.
- **Honest evidence** — Agents are instructed not to invent bones, measurements, or CT alignment claims; missing assets stay marked missing.

### Grok Bot automation — Marrow PR Demo Coach

We integrated a **Cursor / Grok Bot automation** named **Marrow PR Demo Coach** into the GitHub workflow for this repository (`joshuamanigault/Marrow-Sunhacks`).

| | |
| --- | --- |
| **Trigger** | Pull request opened (draft PRs ignored) |
| **Action** | Comments on the PR |
| **Job** | Coaches the author with the live-demo smoke path and §2 acceptance checks from [`docs/demo-script.md`](docs/demo-script.md) |

When a PR opens, the bot leaves one short comment that:

1. Reminds authors of the demo entry path: Landing → Explore → `/workspace/ypm-vp-41198`
2. Lists the §2 checks: open specimen + attribution, select/hide/focus a named bone, Solid / X-ray / Explode + Reset, pin → Save → observations
3. Flags honesty risks: no fake bones; don’t casually break upload or catalog previews
4. Keeps the reviewer focused on demo-breaking regressions before merge

That keeps every PR tied to the judge-facing demo story without a separate ops fleet—Cursor builds the product; Grok Bot keeps PRs honest against the same checklist.

---

## Docs map

| Doc | Purpose |
| --- | --- |
| [`docs/spec.md`](docs/spec.md) | Product spec + decision log |
| [`docs/roadmap.md`](docs/roadmap.md) | MVP tracks and handoffs |
| [`docs/demo-script.md`](docs/demo-script.md) | Live demo / judge checklist |
| [`docs/api/specimen-contract.md`](docs/api/specimen-contract.md) | Specimen API contract |
| [`docs/api/ai-contract.md`](docs/api/ai-contract.md) | Gemini Ask contract |
| [`docs/backend-specimen-setup.md`](docs/backend-specimen-setup.md) | Prepare and serve meshes |
| [`docs/deploy-adding-meshes.md`](docs/deploy-adding-meshes.md) | Deploy / add specimens |
| [`docs/handoff-gemini-setup.md`](docs/handoff-gemini-setup.md) | Wire up Gemini locally |

---

## Team

| Person | Focus |
| --- | --- |
| Joshua | Specimen evidence, conversion, API, deploy |
| Ananya | 3D viewer, Gemini Ask, hand control |
| Alex | Scanner workspace UI shell; AWS S3, Lambda, and CloudFront hosting |}
| Alexandra | Attribution, pins, demo script |

---

## License & attribution

Application code: see repository license terms for this hackathon project.

Fossil study data for YPM VP 41198 is published on Dryad under **CC0-1.0**. Retain specimen identity, researcher credits, and citation when displaying derivatives. Prepared mesh binaries stay out of git; rebuild locally or from your deploy asset store.
