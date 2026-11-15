# Handoff: setting up the Gemini API

**For:** Joshua · **From:** Ananya · **Branch:** `ananya/gemini-features` · **Contract:** [docs/api/ai-contract.md](api/ai-contract.md) · **Spec:** decision log 2026-11-14 (§§4, 6)

## What's on the branch

Three AI features in one **Ask** panel (sparkle icon in the tool rail):

1. **Ask about this bone**: select a bone, then "What is this bone?" or a free question.
2. **Guided tour**: type a topic, and Gemini picks 2 to 6 bones. Each stop uses focus mode.
3. **Observation helper**: a visitor's note turns into one follow-up question.

Gemini only gets a numbered list of facts (manifest identity + `backend/src/marrow/facts/ypm-vp-41198.json`) and has to say which ones it used. The server drops fact ids it never sent and tour stops that aren't loaded bones. Without a key, everything AI is off and the viewer works like before.

**Heads up:** tested with backend tests (fake model) and a browser run against a stand-in model. **Not tested against live Gemini yet.** Step 4 below is that test.

## 1. Get a key

1. Go to Google AI Studio (aistudio.google.com) and create an API key.
2. Keep it out of git and out of anything the browser can see. Never put it in `frontend/.env`: every `VITE_` variable ends up in the public JS bundle.

## 2. Configure the backend

In `backend/.env` (gitignored, copy `backend/.env.example` if you don't have one):

```text
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=
```

`GEMINI_MODEL` blank means `gemini-3.5-flash-lite` (cheap, fast, enough for 2 to 4 sentence answers). Set it to another model id from ai.google.dev/models if you want.

## 3. Install and run

```powershell
git fetch
git switch ananya/gemini-features
cd backend
uv sync                      # adds google-genai
uv run pytest -q             # 24 should pass (9 are the AI tests)
uv run uvicorn marrow.main:app --reload --host 127.0.0.1 --port 8000
```

New terminal:

```powershell
cd frontend
npm install
npm run dev
```

## 4. Smoke test against real Gemini

```powershell
# should say enabled: true and the model name
curl http://127.0.0.1:8000/ai/status

# explain
curl -X POST http://127.0.0.1:8000/ai/explain -H "Content-Type: application/json" `
  -d '{"specimenId":"ypm-vp-41198","structureId":"maxilla_l"}'

# tour
curl -X POST http://127.0.0.1:8000/ai/tour -H "Content-Type: application/json" `
  -d '{"specimenId":"ypm-vp-41198","topic":"How is the snout built?"}'

# follow-up
curl -X POST http://127.0.0.1:8000/ai/followup -H "Content-Type: application/json" `
  -d '{"specimenId":"ypm-vp-41198","structureId":"nasal_r","note":"the surface looks rough"}'
```

(In PowerShell, `curl` may be an alias. Use `curl.exe` or Invoke-RestMethod if the quoting fights you.)

Then in the browser: open a specimen, click the sparkle in the rail, and try all three. Things to check:

- [ ] Answers stick to the facts and don't invent anatomy (bone functions, sizes, ages not in the facts file)
- [ ] Asking something the facts don't cover gets "the study data here doesn't say", not a guess
- [ ] Every tour stop is a real bone, and Back / Next / End tour move focus correctly
- [ ] Each answer shows "AI-generated" and the "Based on N facts" sources

If answers drift past the facts, tighten the rules in `backend/src/marrow/ai/service.py` (`_GROUND_RULES` and the three `*_SYSTEM` prompts).

## 5. Facts file (needs someone who's read the paper)

`backend/src/marrow/facts/ypm-vp-41198.json` has 11 specimen-level facts, each with a source. **Per-bone facts are empty**, so answers about a specific bone stay general. Add them like this, only from the paper or the Dryad README:

```json
"structures": {
  "maxilla_l": [
    { "text": "...", "source": "Margulis-Ohnuma et al. 2026, Fig. 2", "url": "https://doi.org/10.1098/rspb.2026.0130" }
  ]
}
```

Keys are structure ids from `backend/src/marrow/structures.py`. Restart the API after editing (the file is cached).

## 6. Deploying (Vultr)

- Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as server environment variables, not in the repo.
- Watch the AI Studio usage page. The default "What is this bone?" answer is cached per bone in memory, so 21 bones cost about 21 calls per server restart. Custom questions, tours and follow-ups call Gemini every time, and there's no rate limit yet. Worth adding one before a public demo.

## Troubleshooting

| You see | Means |
| --- | --- |
| No sparkle in the rail | `/ai/status` says disabled: key missing or the API wasn't restarted |
| 503 | No `GEMINI_API_KEY` on the server |
| 502 "AI service didn't answer" | Gemini call failed (bad key, quota, model id). The real error is in the uvicorn log |
| 502 "Couldn't build a tour" | Gemini picked no valid bones. Reword the topic |
| 404 | Unknown structure id |
| 422 | Input too long (question 300, topic 200, note 500 chars) |

## Files

- Backend: `backend/src/marrow/ai/` (facts, llm, service), `routes/ai.py`, `models/ai.py`, `facts/ypm-vp-41198.json`, `tests/test_ai.py`
- Frontend: `frontend/src/ai/` (`api.ts`, `AskPanel.tsx`, `ask.css`), plus the Ask tool in `workspace/Workspace.tsx`

Also on this branch: a small fix for typecheck errors that are on `main` right now (duplicate `Structure.color`, and `setPick` declared twice). `main` doesn't pass `npm run typecheck` without it.
