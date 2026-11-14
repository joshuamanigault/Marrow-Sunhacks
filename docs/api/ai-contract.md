# AI contract (Gemini)

**Spec:** §4 (Gemini through FastAPI, key server-side), §6 (generated text is never the source of anatomical labels or measurements). Decision log: 2026-11-14.

All routes are optional. Without `GEMINI_API_KEY` they answer **503** and the frontend hides the Ask panel, so the viewer works the same as before.

## Grounding

Gemini only sees a numbered list of facts and is told to use nothing else:

- **Manifest facts** for the bone: name, side, specimen, source STL file (added automatically).
- **Curated facts** from `backend/src/marrow/facts/{specimenId}.json`. Each one names its source. Add per-bone facts under `structures` only from the paper or the Dryad README.

Responses return the facts the model says it used (ids it didn't receive are dropped) and the specimen citation. The UI labels every answer "AI-generated".

## Endpoints

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/ai/status` | | `{ enabled, model }` |
| `POST` | `/ai/explain` | `{ specimenId, structureId, question? }` (≤300 chars) | `{ answer, covered, facts[], citation, aiGenerated }` |
| `POST` | `/ai/tour` | `{ specimenId, topic }` (1–200 chars) | `{ title, steps[{ structureId, caption, facts[] }], citation, aiGenerated }` |
| `POST` | `/ai/followup` | `{ specimenId, structureId, note }` (1–500 chars) | `{ question, facts[], citation, aiGenerated }` |

- `covered: false` means the facts didn't answer the question.
- Tour steps only use structures with status `ok`; unknown or repeated ids are dropped; at most 6 stops. No valid stop → **502**.
- The default "What is this bone?" answer (no `question`) is cached per bone and model.
- Gemini failures → **502** with a plain message. Unknown structure → **404**. Too-long input → **422**.

## Config

```
GEMINI_API_KEY=...            # server only
GEMINI_MODEL=                 # optional, defaults to gemini-3.5-flash-lite
```

## Frontend

`frontend/src/ai/`: `api.ts` (client + `useAiEnabled`) and `AskPanel.tsx` (rail panel with Ask about this bone, Guided tour, Observation helper). The tour drives the viewer's focus mode (`useViewer().focus`).
