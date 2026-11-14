# Marrow — MVP roadmap (four parallel tracks)

Source of truth: [product spec](spec.md). This roadmap only covers work needed to hit the **§2 first demo** with a **mesh-only** specimen. Linked CT slices and Gemini stay open (§6) unless the team consciously pulls them in after MVP is demoable.

**Horizon:** about one continuous hackathon day (~24h), not a timed phase plan. Work is owned as parallel task lists that meet at clear handoff points.

**People:** Alexandra · Alex · Joshua · Ananya  
**Primary builder (evidence → app):** Joshua owns fossil assets, conversion, and the API that serves them into the web app.

One track below is labeled **novice-friendly**: impactful, demo-visible, and bounded so someone newer to hackathons can ship without blocking the 3D or asset pipeline. Reassign that track if needed; keep the task shape.

---

## MVP definition (must ship)

A visitor can do all of the following on **one** curated specimen (*Eosphorosuchus lacrimosa* / YPM VP 41198, or whatever single study the team actually prepares):

| Outcome (spec §2) | Done means |
| --- | --- |
| Opens the specimen | Animal, museum accession, and source/citation are visible. Real prepared meshes load; missing/unreadable parts are called out, not faked. |
| Inspects one named bone | Rotate; select / focus / hide / restore; colors and names match the same source element (left vs right maxilla stay distinct). |
| Looks behind overlap | Solid and X-ray (opacity style, not a radiograph); explode + separation slider; zero separation = original pose; Reset restores camera + display. |
| Pins an observation | Pin on a bone in exploded view stays on that anatomical point through reassemble/reset; revisit in the same browser restores note + location (local, anonymous). |

**Not MVP:** uploads, accounts, shared rooms, real CT slice UI, Gemini, Tiger Data schema work unless something above is blocked without it.

---

## Parallel tracks

### Joshua — Specimen evidence, conversion, and API

**Owns:** Dryad/archive → inspectable files → web-ready meshes + metadata → FastAPI that the viewer can call. Spec §§4–5.

**Tasks**

1. Obtain the published dataset; record reuse terms, citation, accession, and researcher credits in a short `docs` or metadata note the UI can consume.
2. Inventory Appendix 2 (and whatever is actually on disk): one row per mesh file with a **stable structure id**, display name, side (L/R/none), source filename, and status (`ok` / `missing` / `unreadable`).
3. Convert/normalize only what is needed for the browser (e.g. STL → glTF/GLB or another Three-friendly form). Do **not** invent bones. Preserve identity; do not assume scale/axis/alignment without checking.
4. Keep binaries **out of git**; serve or place them where local/dev and the eventual host can reach them. Document the local path / URL pattern for the frontend.
5. Extend the API beyond `/health`: a small **specimen** payload (identity + credits + citation + list of structures with public mesh URLs and colors if known). No database required for MVP if a static JSON + file server (or FastAPI static mount) is enough.
6. Smoke-check: each `ok` mesh URL loads; bad entries surface as `missing`/`unreadable` in the payload.

**Handoffs out:** specimen JSON contract + at least a few real meshes → Ananya & Alex; citation/credits fields → Alexandra.

**Handoffs in:** structure naming/color expectations from Ananya; any UI field gaps from Alexandra/Alex.

---

### Ananya — 3D viewer core

**Owns:** React Three Fiber / Three.js scene that proves §2 inspection and explode behavior. Spec §§2–3, §4 browser row.

**Tasks**

1. Replace the scaffold page with a route/view that mounts a full-canvas scene (chrome can be stubbed until Alex lands UI).
2. Load Joshua’s meshes from the specimen payload; keep **bone id** on each object (not just display name).
3. Camera: orbit/drag rotate; Reset returns to the initial camera.
4. Selection: click (and/or pick from a stub list) sets the active structure; highlight matches the same id the UI will show.
5. Per-structure visibility and focus (frame the selected bone).
6. Display modes: **Solid** / **X-ray** (material opacity only); **Exploded** with a separation factor; at `0` parts sit in the authored arrangement.
7. Coordinate rule: store pin-ready position in **specimen/bone space**, independent of camera and explode offset (needed for Alexandra’s pins).
8. Expose viewer state (Zustand is fine) so the shell can bind controls without owning Three internals.

**Handoffs out:** working scene + state API (selected id, visibility map, mode, separation, reset, bone-space hit point) → Alex & Alexandra.

**Handoffs in:** specimen payload + mesh URLs from Joshua; control layout/labels from Alex.

---

### Alex — Scanner workspace UI (shell)

**Owns:** The §3.1 desktop composition around the fossil: header, tool rail, one contextual panel, bone list, bottom dock. Does not need to own shader math.

**Tasks**

1. Layout: specimen takes the largest area; floating **specimen header** (name, accession, source) top-left; slim **tool rail** opens **one** panel at a time (anatomy vs specimen info — fossil stays visible).
2. Anatomy panel: Solid / X-ray / Exploded grouped; separation slider directly under; wired to Ananya’s state.
3. Structure list: one row per verified structure — color swatch, name, visibility toggle, focus. “Color by structure” vs natural bone tones.
4. Bottom dock: **Reset view** and **Pin observation** together (Pin can call into Alexandra’s flow).
5. Keyboard-friendly labeled rotate actions in addition to drag (can delegate rotate amounts to Ananya).
6. Apply the quiet canvas / panel look from §3.1 (ivory `#f5f0e9`, accent `#1f5673`; optional dark later). No fake CT/split tabs until real CT exists.
7. Narrow layout: specimen first, reachable controls, no horizontal scroll (good enough for demo, not a full design system).

**Handoffs out:** controls that drive the scene; places for Alexandra’s copy and pin UI.

**Handoffs in:** live state from Ananya; real names/colors/status from Joshua’s payload.

---

### Alexandra — Novice-friendly: visitor story, attribution, and local pins

**Owns:** Demo-visible product surface that does not block meshing or Three.js. Spec §1, §2 pin row, §5 credits.

**Why this track:** Clear acceptance checks, mostly React + `localStorage`, copy, and wiring to APIs Ananya/Joshua already expose. High impact on “museum visitor can explain what they saw.”

**Tasks**

1. **Start / open specimen:** simple entry into the workspace (even one curated button) that loads Joshua’s specimen id.
2. **Specimen information** content for Alex’s info panel: animal, YPM accession, Dryad/citation link, researcher credits, short “what you’re looking at” blurb grounded in the real study (no invented anatomy).
3. **Honest asset status:** if the payload marks a part missing/unreadable, show that in the list or a small notice — never substitute an illustration.
4. **Pin observation MVP:** UI to place a note on the selected bone (Ananya supplies bone id + bone-space point); save anonymously in **this browser** only; restore on reopen of the same specimen; confirm pin still sits on the bone after explode → reassemble → reset.
5. **Demo script** (short checklist in `docs/` or Superpowers): what a judge should click, in order, mapped to §2 rows.
6. Polish empty/error states: API down, mesh fail, no pin yet — plain language.

**Handoffs out:** pin persistence shape; final attribution copy; demo checklist for the whole team.

**Handoffs in:** specimen fields from Joshua; `selectedStructureId` + bone-space pick from Ananya; dock/panel slots from Alex.

---

## Integration order (not hour blocks)

Do this in dependency order when merging; people still work in parallel on mocks/stubs:

1. **Joshua** publishes a specimen payload + a few real meshes (even a subset of the skull is enough to unblock).
2. **Ananya** loads those meshes and proves select / hide / solid-xray-explode / reset.
3. **Alex** replaces stubs with the real chrome bound to that state.
4. **Alexandra** fills attribution + local pins on the same specimen id.
5. Team run-through against the §2 table; fix only what breaks the demo story.

Stub rule: Ananya may use placeholder boxes until meshes arrive; Alex may hard-code panel chrome against fake structure rows; Alexandra may pin against a mock id — but the demo itself must run on Joshua’s real inventory before you call MVP done.

---

## Explicitly later (do not staff until MVP works)

- Real CT volume / NiiVue / mesh–volume alignment (§5–6)
- Gemini or any AI copy that invents labels (§6)
- Tiger Data tables, auth, shared notes, LiveKit, uploads (§6 deferred)
- Multi-specimen catalog beyond one curated study

---

## Agent / teammate usage

Before a task, read [spec.md](spec.md) and name the §2 outcome you are advancing. Put detailed implementation plans under [superpowers/](superpowers/README.md) and link them here or to the spec section. If scope changes, update the spec decision log first, then this roadmap.
