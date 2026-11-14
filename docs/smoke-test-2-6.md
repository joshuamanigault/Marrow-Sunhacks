# Smoke test — Alexandra parts 2–6 (no start page)

**Skip part 1** (start button scraped).  
**Servers:** API `http://127.0.0.1:8000` · App `http://127.0.0.1:5173`

## Open this URL

**http://127.0.0.1:5173/workspace/ypm-vp-41198**

(or just http://127.0.0.1:5173/ — it redirects into the workspace)

---

## Part 2 — Specimen information

| # | Do this | Pass when… |
| --- | --- | --- |
| 2.1 | Tool rail → **Specimen information** (info icon) | Panel opens; fossil stays visible |
| 2.2 | Read animal / accession / collection | *Eosphorosuchus* / YPM VP 41198 / institution show |
| 2.3 | Read researchers + citation | Credits list + citation text |
| 2.4 | Click Dryad / source link | Opens dataset URL |
| 2.5 | Read “what you’re looking at” | Blurb about prepared meshes; no invented bones |

---

## Part 3 — Honest asset status

| # | Do this | Pass when… |
| --- | --- | --- |
| 3.1 | Tool rail → **Anatomy** | Structure list appears |
| 3.2 | Find rows that are not ready | `missing` / `unreadable` badges (or summary banner) |
| 3.3 | Confirm no fake art | No illustration substituted for bad meshes |

---

## Part 4 — Pin observation

| # | Do this | Pass when… |
| --- | --- | --- |
| 4.1 | Bottom dock → **Pin observation** | Observations panel opens |
| 4.2 | Click a **Demo pick** | Selected bone + bone-space point show |
| 4.3 | Type a note → **Save pin** | Pin appears in Saved pins |
| 4.4 | Refresh the page (F5) or reopen the same URL | Same pin restores (this browser only) |
| 4.5 | Optional: **Reset view** after pin | Note still listed; point still bone-space |

---

## Part 5 — Demo script

| # | Do this | Pass when… |
| --- | --- | --- |
| 5.1 | Open `docs/demo-script.md` | Checklist exists and maps to §2 |
| 5.2 | Walk §2.1 steps 3–5 and §2.4 (skip start-button steps) | Matches what you see in the app |

---

## Part 6 — Empty / error states

| # | Do this | Pass when… |
| --- | --- | --- |
| 6.1 | Observations with no pins (clear pins or use a private window first) | “No pins yet” plain-language empty state |
| 6.2 | Stop the API (Ctrl+C in backend terminal), refresh workspace | Plain “server unavailable / could not load” message + Try again |
| 6.3 | Start API again, click Try again | Specimen loads again |
| 6.4 | If any structures are missing/unreadable | Mesh warning banner in Anatomy (no crash) |

---

## Quick pass / fail

- [ ] Part 2 info content OK  
- [ ] Part 3 honest status OK  
- [ ] Part 4 pin save + restore OK  
- [ ] Part 5 script still usable without start button  
- [ ] Part 6 empty + API-down OK  
