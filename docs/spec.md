# Marrow — product spec

## 1. What a visitor can do

Marrow is a browser workspace for exploring the anatomy preserved in a real fossil CT study. A student or museum visitor opens a curated specimen, turns it to find a bone, inspects that bone in context, and leaves an observation they can return to. Start with one well-attributed specimen. A visitor should be able to explain what they saw and find the study it came from without uploading a scan, signing in, or asking an AI.

## 2. First demo: observable outcomes

| A visitor… | The demo succeeds when… |
| --- | --- |
| Opens the specimen | The workspace identifies the animal, museum accession, and source. It displays the prepared anatomy the researchers actually extracted; missing or unreadable assets are identified rather than replaced with an illustration. |
| Inspects one named bone | They can rotate the specimen, select and focus the bone, hide and restore it, and distinguish bones by color and name. The selected name and highlighted geometry refer to the same source element. |
| Looks behind an overlapping bone | Solid and X-ray change surface opacity; X-ray is a rendering style, not a radiograph. Explode separates the parts for inspection. At zero separation they return to their original arrangement. Reset restores the initial camera and display settings. |
| Pins an observation and comes back | A pin placed on a bone in exploded view stays on the same anatomical point through reassembly and reset. Reopening the same specimen in the same browser restores the note and its location. Notes are anonymous, local to that browser, and never imply a shared room. |

These are acceptance checks for a later viewer task. The kickoff delivers a startup page and a healthy API; it does not deliver this demo.

## 3. What we take from Lobe

Lobe processes **brain MRI**. Its Python/FastAPI service turns four MRI sequences into segmentation masks, named 3D surfaces and a case report. A visitor can open a prepared case without running inference. The React viewer uses Three.js to render the surfaces and NiiVue to show actual volume slices. Lobe keeps scan coordinates distinct from camera, opacity and explode settings; its Convex layer separately supports live sessions and an assistant.

Marrow follows the prepared-case path: open an attributed specimen, select a named structure, and change the view without changing the underlying evidence. Keep bone identity and the original point on the bone independent of screen pixels, camera position, or exploded pose.

### 3.1. Scanner workspace: design target from `preview.html`

On desktop, the specimen gets the largest uninterrupted area. A floating header at the upper left identifies the specimen; beneath it, a slim tool rail opens **one contextual panel at a time**. Opening specimen information in place of anatomy controls leaves the fossil in view. Keep **Reset view** and **Pin observation** together in a small bottom dock so a visitor can use either without leaving the canvas.

The initial anatomy view shows the assembled fossil in **Solid** with zero separation. Put **Solid / X-ray / Exploded** together, with a separation slider directly below. Each verified structure gets a named row with a color swatch, visibility toggle and focus action; a single “Color by structure” control switches between those colors and natural bone tones. Support drag to rotate and labeled rotation buttons for keyboard users. Use the specimen's actual structures in these rows; the preview's four groups illustrate the interaction.

Keep the warm bone silhouette legible against the quiet canvas. The preview pairs an ivory scene (`#f5f0e9`), white panels and a slate-blue accent (`#1f5673`); in dark mode it uses a charcoal scene (`#182128`) and a pale blue accent (`#a9d0e6`). Rounded panels, thin borders and restrained shadows separate controls from the fossil. For later visual review, check the desktop composition at 1024 px and a narrow layout at 320 px: the specimen should appear before the contextual panel on a phone, with reachable actions, readable labels and no horizontal scrolling.

The preview shows **3D / Split / Slices** and a **Compare slices** shortcut. If the team adopts verified CT viewing (§§5–6), place sections beside the 3D scene on desktop and preserve the selected specimen when switching views. Until then, show only working 3D controls. The procedural skull, drawn slices, sample discussion, Invite and study-room controls demonstrate a concept; they do not supply scientific evidence or add collaboration to the first demo.

## 4. Architecture decisions

| Owner | Responsibility |
| --- | --- |
| Browser: React + TypeScript + Vite | Present the specimen and handle interaction. React Router is intended for navigation, React Three Fiber/Three.js and Drei for the scene, and Zustand for viewer state. Keep observations in the browser initially. |
| Python API: FastAPI, Uvicorn, Pydantic settings | Own application APIs and external-service access. The browser receives public URLs and data; database credentials and AI keys stay on the server. |
| Tiger Data: PostgreSQL | Intended database for application records that need persistence on the server. It is not the store for CT archives or mesh binaries. Choose tables, asset storage and access patterns when a real feature requires them. |
| Gemini | Intended provider for an in-app AI feature through FastAPI. The team has not chosen the interaction, model or inputs. The viewer must be usable without an AI key. |

Use npm for the frontend and uv for Python. Windows local development must work without Docker or WSL. Vultr is the intended hosting destination; no provisioning is part of kickoff.

## 5. Specimen and evidence

First candidate: *Eosphorosuchus lacrimosa*, Yale Peabody Museum **YPM VP 41198**. [Margulis-Ohnuma, Ruebenstahl, Meyer & Bhullar (2026), Dryad dataset](https://datadryad.org/dataset/doi%3A10.5061/dryad.q83bk3jvv). The authors list a micro-CT TIFF stack in Appendix 1 and separate skull-element STL meshes in Appendix 2. For example, they list both left and right maxillae: picking one should identify that side, not highlight both because they share a bone name.

The published inventory is evidence of what the authors deposited. No fossil binary has been inspected, converted, rendered, or registered in this planning work. Before showing a derivative, check the actual files and reuse terms; retain specimen identity, researcher credits, citation, and the mapping from each displayed bone to its source. Keep source archives and prepared binaries outside normal source commits. Do not invent missing anatomy or assume a common scale, axis convention, or alignment. Lobe's MRI transforms, hemisphere split and mask cleanup are not fossil-processing defaults.

Meshes describe surfaces. They are neither CT intensity slices nor voxel labels. If the team later chooses linked CT, verify voxel order, spacing, orientation, and mesh-to-volume alignment at identifiable landmarks on multiple slices before showing linked pins or overlays. If alignment is unknown, keep the mesh viewer useful on its own and make no alignment claim.

## 6. Decisions still open and work deferred

- **Open — real CT slice viewing:** include it only if the team chooses it and the assets support it. A mesh-only demo can meet §2. Synthetic slices do not count.
- **Open — Gemini experience:** select a visitor task and supporting evidence before choosing a model or API contract. Generated text is not the source of anatomical labels or measurements.
- **Open — implementation details:** prepared asset format and storage, database schema, and the viewer's component and state structure are decided on first use. The visible scanner layout is described in §3.1.
- **Deferred:** public uploads and processing, accounts, shared notes, collaboration, chat, voice/LiveKit, presenter following and shared cameras. Do not scaffold them. Lobe's clinical segmentation, games and session reports are outside the first demo. Cursor/Grok raffle work is separate; Solana is excluded.

## 7. How agents use this spec

Read `docs/spec.md` before a task. Name the section and observable outcome the task advances. Keep feature designs and implementation plans in [Superpowers](superpowers/README.md) and link them back here. A plan or visual mockup may refine an interaction; it cannot silently promote an open question into a requirement. When the team changes scope, update this file first and add a dated decision with the change, reason and affected section. Record what has actually been verified separately from planned acceptance checks.

Decision log — Kickoff baseline: start with one curated mesh-based study (§§1–2). Linked CT and the Gemini interaction remain open (§6).

Decision log — 2026-11-14, Gemini interaction (§§4, 6): the visitor task is **grounded explanation**. An Ask panel offers (1) "Ask about this bone", (2) a guided tour that steps through bones using focus mode, and (3) an observation helper that suggests one follow-up question. Gemini runs only through FastAPI, sees only manifest facts and the cited facts file (`backend/src/marrow/facts/`), and every answer is labelled AI-generated with its sources. Generated text never supplies labels or measurements; tour stops are limited to loaded structure ids. Without `GEMINI_API_KEY` the routes return 503 and the panel is hidden. Contract: [docs/api/ai-contract.md](api/ai-contract.md). Verified: backend tests with a fake model and a browser run against a stand-in model; not yet verified against live Gemini.
Decision log — 2026-11-14, hand control (§§2, 3.1): optional webcam hand gestures drive the same viewer state as the mouse and panel. Point to highlight a bone and hold to select it, pinch and move to rotate, open hand to explode and fist to reassemble. MediaPipe HandLandmarker runs in the browser; no video leaves the machine. Off by default behind a "Hand control" toggle over the scene. Verified: gesture rules against synthetic landmarks and a browser run of the toggle, error path and gesture-to-viewer wiring; not yet verified with a live webcam hand.
