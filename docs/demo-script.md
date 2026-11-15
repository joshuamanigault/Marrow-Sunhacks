# Marrow demo script — judge checklist

**Owner:** Alexandra (roadmap task 5)  
**Maps to:** [spec §2 first demo outcomes](spec.md)  
**Specimen:** *Eosphorosuchus lacrimosa* / **YPM VP 41198** (`ypm-vp-41198`)  
**UI shell:** Alex’s scanner workspace · **API:** Joshua `GET /specimens/{id}` · **3D:** Ananya (when mounted)

Use this click order for a live demo. Each block is one §2 row.

**How to start**

1. Run the API (`backend`) and frontend (`frontend`: `npm run dev`).
2. Open **http://localhost:5173/workspace/ypm-vp-41198** (or `/` — redirects into the workspace).  
   There is **no curated start-page button** on this branch (Alexandra part 1 scraped).

---

## §2.1 — Opens the specimen

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 1 | Open `/workspace/ypm-vp-41198` | Workspace loads from Joshua’s API |
| 2 | Header (top-left) | Scientific name, accession, institution |
| 3 | Tool rail → **Specimen information** | Researchers, citation, Dryad link, “what you’re looking at” blurb |
| 4 | Tool rail → **Anatomy** | Structure list shows Ready vs Missing/Unreadable; no fake stand-in art |

**Fail if:** API error with no plain-language message; missing parts replaced by illustrations.

---

## §2.2 — Inspects one named bone

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 6 | Drag / rotate buttons | Specimen turns |
| 7 | Select a named bone in the anatomy list | Caption matches the highlighted bone id |
| 8 | Hide / focus | Same structure id |
| 9 | Left vs right | Left maxilla ≠ right maxilla |

> Needs Ananya’s scene for full pass; list selection still works on the shell store.

---

## §2.3 — Looks behind an overlapping bone

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 10 | Solid → X-ray | Opacity style changes |
| 11 | Exploded + separation | Parts separate |
| 12 | Separation → 0% | Original arrangement |
| 13 | **Reset view** | Initial camera + display |

---

## §2.4 — Pins an observation and comes back

| Step | Click / look | Pass when… |
| --- | --- | --- |
| 14 | Optional: Exploded mode | Pin while separated |
| 15 | **Pin observation** (dock) or Observations panel | Notes panel opens |
| 16 | Demo pick (or 3D pick) + note → **Save pin** | Pin listed with bone-space `(x,y,z)` |
| 17 | Reset / reassemble | Pin stays on same anatomical point (bone-space) |
| 18 | Refresh or reopen `/workspace/ypm-vp-41198` | Same note restores (`localStorage` `marrow:pins:ypm-vp-41198`) |
| 19 | Privacy | Copy says anonymous / this browser only |

---

## Quick fail checks

- Missing/unreadable parts faked with art  
- Pins stored as screen clicks only (no bone id + bone-space point)  
- Notes require sign-in or imply a shared room  
- Citation / accession missing after open  

## Team map

| §2 row | Builders |
| --- | --- |
| Opens | Joshua API + Alex workspace header/info (no start-page entry on this branch) |
| Inspects | Ananya + Alex anatomy list |
| Looks behind | Ananya + Alex modes / Reset |
| Pins | Alexandra notes panel + Ananya `useViewer().pick` |
