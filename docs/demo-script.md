# Marrow demo script — judge checklist

**Owner:** Alexandra (roadmap task 5)  
**Maps to:** [spec §2 first demo outcomes](spec.md)  
**Specimen:** *Eosphorosuchus lacrimosa* / **YPM VP 41198** (`ypm-vp-41198`)

Use this as the click order for a live demo or judging pass. Each block is one §2 row. Check the box only when the success line is true.

**How to start locally**

1. From `frontend/`: run `npm run dev` and open the printed URL (usually `http://localhost:5173`).
2. Backend `/health` is optional for this visitor path today (credits/structures are still local stubs until Joshua’s API).

---

## §2.1 — Opens the specimen

**Goal:** Animal, museum accession, and source are visible. Prepared parts load honestly; missing/unreadable parts are named, not faked.

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 1 | Land on the start page | You see **Marrow** and one curated button **Open YPM VP 41198** |
| 2 | Click **Open YPM VP 41198** | URL becomes `/workspace/ypm-vp-41198` |
| 3 | Read the header | Animal (*Eosphorosuchus lacrimosa*), accession **YPM VP 41198**, collection + Dryad source are visible |
| 4 | Open **Specimen information** content | Researchers, Dryad/citation link, reuse note, and “What you are looking at” blurb are present (no invented anatomy) |
| 5 | Read **Prepared structures** | Ready / Missing / Unreadable badges appear; missing/unreadable rows have **no** illustration stand-in |

**§2.1 success:** A judge can name the animal, accession, and source, and can see which parts are not displayable.

---

## §2.2 — Inspects one named bone

**Goal:** Rotate; select / focus / hide / restore; colors and names match the same source element (left vs right stay distinct).

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 6 | Use the 3D stage (Ananya) | Drag rotates the specimen; labeled rotate controls work if present |
| 7 | Select one named bone (e.g. Maxilla left) | Selected name in the UI matches the highlighted mesh id |
| 8 | Toggle visibility / focus on that bone | Bone hides and restores; focus frames the same structure |
| 9 | Confirm left vs right | Choosing left maxilla does **not** highlight right maxilla |

**§2.2 success:** Name, color, and geometry refer to the same inventory row.

> **Stub note:** Until Ananya’s Three.js canvas is mounted, the stage shows a placeholder. Demo pick buttons in the pin dock can still select an `ok` structure id for pin testing.

---

## §2.3 — Looks behind an overlapping bone

**Goal:** Solid / X-ray opacity; explode + separation; zero separation = original pose; Reset restores camera + display.

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 10 | Switch **Solid** → **X-ray** | Surfaces become more see-through (style only — not a real radiograph claim) |
| 11 | Switch to **Exploded** and raise separation | Parts move apart for inspection |
| 12 | Set separation back to **0%** | Parts return to the original arrangement |
| 13 | Click **Reset view** | Camera and display settings return to the initial Solid / assembled state |

**§2.3 success:** Overlap can be inspected without inventing anatomy; reset is trustworthy.

> **Stub note:** These controls live in Alex’s shell + Ananya’s viewer state. Skip or mark “blocked” if that chrome is not merged yet.

---

## §2.4 — Pins an observation and comes back

**Goal:** Pin on a bone in exploded view stays on the same anatomical point through reassemble/reset; reopen in the same browser restores note + location; anonymous / local only.

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 14 | (Optional) Explode the specimen first | Pin is placed while parts are separated |
| 15 | Select a bone + pick a point | Pin dock shows selected bone and a **bone-space** `(x, y, z)` (use **Demo pick** until Three.js picking exists) |
| 16 | Type a short note → **Save pin** | Pin appears under **Saved pins** with bone label + bone-space point |
| 17 | Reassemble / Reset (when available) | Pin remains on the same anatomical point (bone-space, not screen pixels) |
| 18 | Leave workspace → open **Open YPM VP 41198** again | Same note and location restore from `localStorage` (`marrow:pins:ypm-vp-41198`) |
| 19 | Confirm privacy copy | UI states notes are anonymous and **this browser only** (no shared room) |

**§2.4 success:** Judge can show a restored local pin on the correct bone after reopen (and after explode/reset when the 3D path is live).

---

## Quick fail checks (do not pass the demo if…)

- Missing parts are replaced with artwork or a fake mesh
- Left/right bones share one highlight because they share a display name
- Pins are stored only as screen clicks (no bone id + bone-space point)
- Notes require sign-in or appear as a multi-user room
- Citation / accession / Dryad link are missing from the open specimen view

---

## Team handoff map

| §2 row | Primary builders |
| --- | --- |
| Opens the specimen | Alexandra (entry, credits, honest status) + Joshua (payload/meshes) |
| Inspects one named bone | Ananya (Three.js) + Alex (structure list chrome) + Joshua (ids) |
| Looks behind overlap | Ananya (modes/explode) + Alex (Solid/X-ray/Exploded + Reset) |
| Pins and comes back | Alexandra (dock + localStorage) + Ananya (bone-space pick + markers) |

Link this script from the [team roadmap](roadmap.md) when demoing; keep [spec §2](spec.md) as the source of truth if wording conflicts.
