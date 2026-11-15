import { useEffect, useRef, useState, type FormEvent } from 'react'
import { structureLabel, type Specimen } from '../workspace/specimen'
import { useViewer } from '../workspace/viewer'
import { explainBone, followUp, planTour, type Fact, type TourResult } from './api'
import './ask.css'

/** Runs one request at a time, cancels the previous one, and tracks loading / error. */
function useRequest<T>() {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef<AbortController | null>(null)
  useEffect(() => () => current.current?.abort(), [])

  async function run(fn: (signal: AbortSignal) => Promise<T>) {
    current.current?.abort()
    const req = new AbortController()
    current.current = req
    setBusy(true)
    setError(null)
    try {
      const result = await fn(req.signal)
      if (!req.signal.aborted) setData(result)
      return result
    } catch (e) {
      if (!req.signal.aborted) setError((e as Error).message)
      return null
    } finally {
      if (!req.signal.aborted) setBusy(false)
    }
  }
  function clear() {
    current.current?.abort()
    setData(null)
    setError(null)
    setBusy(false)
  }
  return { data, error, busy, run, clear }
}

function Sources({ facts, citation }: { facts: Fact[]; citation: Specimen['citation'] }) {
  return (
    <details className="ask-sources">
      <summary>Based on {facts.length ? `${facts.length} fact${facts.length > 1 ? 's' : ''}` : 'the study'}</summary>
      {facts.length > 0 && (
        <ul>
          {facts.map((f) => (
            <li key={f.id}>
              {f.text}{' '}
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer">
                  {f.source}
                </a>
              ) : (
                <span>{f.source}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="ws-subtle">{citation.text}</p>
    </details>
  )
}

function AiTag() {
  return <span className="ask-tag">AI-generated · only from the study’s facts</span>
}

function ExplainSection({ specimen }: { specimen: Specimen }) {
  const selectedId = useViewer((s) => s.selectedId)
  const selected = specimen.structures.find((s) => s.id === selectedId)
  const [question, setQuestion] = useState('')
  const req = useRequest<Awaited<ReturnType<typeof explainBone>>>()
  const { clear } = req

  // A new bone gets a fresh conversation.
  useEffect(() => {
    clear()
    setQuestion('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  if (!selected) {
    return <p className="ws-subtle">Select a bone in the scene or the structure list to ask about it.</p>
  }

  function ask(q: string | null) {
    void req.run((signal) => explainBone(specimen.id, selected!.id, q, signal))
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (question.trim()) ask(question.trim())
  }

  return (
    <>
      <p className="ask-bone">{structureLabel(selected)}</p>
      <button type="button" className="ask-primary" disabled={req.busy} onClick={() => ask(null)}>
        What is this bone?
      </button>
      <form className="ask-row" onSubmit={onSubmit}>
        <input
          type="text"
          value={question}
          maxLength={300}
          placeholder="Ask something else…"
          aria-label={`Question about ${structureLabel(selected)}`}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" disabled={req.busy || !question.trim()}>
          Ask
        </button>
      </form>
      {req.busy && <p className="ws-subtle" role="status">Thinking…</p>}
      {req.error && <p className="ask-error" role="alert">{req.error}</p>}
      {req.data && (
        <div className="ask-answer" aria-live="polite">
          <AiTag />
          <p>{req.data.answer}</p>
          {!req.data.covered && <p className="ws-subtle">The study data here doesn’t fully answer this.</p>}
          <Sources facts={req.data.facts} citation={req.data.citation} />
        </div>
      )}
    </>
  )
}

function TourSection({ specimen }: { specimen: Specimen }) {
  const [topic, setTopic] = useState('')
  const [tour, setTour] = useState<TourResult | null>(null)
  const [step, setStep] = useState(0)
  const req = useRequest<TourResult>()
  const focus = useViewer((s) => s.focus)

  // Uses focus mode: the stop's bone zooms in, the rest explode and fade.
  function goTo(i: number, t = tour) {
    if (!t) return
    setStep(i)
    const id = t.steps[i].structureId
    if (useViewer.getState().focusedId !== id) focus(id)
  }
  function end() {
    const focused = useViewer.getState().focusedId
    if (focused) focus(focused) // pressing focus again reassembles and goes home
    setTour(null)
    req.clear()
  }
  async function start(e: FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    const t = await req.run((signal) => planTour(specimen.id, topic.trim(), signal))
    if (t) {
      setTour(t)
      goTo(0, t)
    }
  }

  if (tour) {
    const s = tour.steps[step]
    const bone = specimen.structures.find((x) => x.id === s.structureId)
    return (
      <div className="ask-answer">
        <AiTag />
        <p className="ask-bone">{tour.title}</p>
        <p className="ws-subtle">
          Stop {step + 1} of {tour.steps.length} · {bone ? structureLabel(bone) : s.structureId}
        </p>
        <p>{s.caption}</p>
        <div className="ask-row">
          <button type="button" disabled={step === 0} onClick={() => goTo(step - 1)}>
            Back
          </button>
          {step < tour.steps.length - 1 ? (
            <button type="button" className="ask-primary" onClick={() => goTo(step + 1)}>
              Next stop
            </button>
          ) : (
            <button type="button" className="ask-primary" onClick={end}>
              Finish
            </button>
          )}
          <button type="button" onClick={end}>
            End tour
          </button>
        </div>
        <Sources facts={s.facts} citation={tour.citation} />
      </div>
    )
  }

  return (
    <>
      <form className="ask-row" onSubmit={start}>
        <input
          type="text"
          value={topic}
          maxLength={200}
          placeholder="e.g. How is the snout built?"
          aria-label="Tour topic"
          onChange={(e) => setTopic(e.target.value)}
        />
        <button type="submit" disabled={req.busy || !topic.trim()}>
          Start
        </button>
      </form>
      {req.busy && <p className="ws-subtle" role="status">Planning the tour…</p>}
      {req.error && <p className="ask-error" role="alert">{req.error}</p>}
    </>
  )
}

function FollowupSection({ specimen }: { specimen: Specimen }) {
  const selectedId = useViewer((s) => s.selectedId)
  const selected = specimen.structures.find((s) => s.id === selectedId)
  const [note, setNote] = useState('')
  const req = useRequest<Awaited<ReturnType<typeof followUp>>>()
  const { clear } = req
  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  if (!selected) return <p className="ws-subtle">Select a bone first, then write what you notice.</p>

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (note.trim()) void req.run((signal) => followUp(specimen.id, selected!.id, note.trim(), signal))
  }
  return (
    <form onSubmit={onSubmit}>
      <textarea
        className="ask-note"
        value={note}
        maxLength={500}
        rows={3}
        placeholder={`What do you notice about the ${selected.name.toLowerCase()}?`}
        aria-label="Your observation"
        onChange={(e) => setNote(e.target.value)}
      />
      <button type="submit" disabled={req.busy || !note.trim()}>
        Suggest a follow-up question
      </button>
      {req.busy && <p className="ws-subtle" role="status">Thinking…</p>}
      {req.error && <p className="ask-error" role="alert">{req.error}</p>}
      {req.data && (
        <div className="ask-answer" aria-live="polite">
          <AiTag />
          <p>{req.data.question}</p>
          <Sources facts={req.data.facts} citation={req.data.citation} />
        </div>
      )}
    </form>
  )
}

/** The "Ask" panel: explain a bone, take a guided tour, get a follow-up question. */
export default function AskPanel({ specimen }: { specimen: Specimen }) {
  // Closing Ask unmounts this panel; exit any tour focus so the viewer is not left exploded.
  useEffect(() => {
    return () => {
      const focused = useViewer.getState().focusedId
      if (focused) useViewer.getState().focus(focused) // same as TourSection end() / second Focus press
    }
  }, [])

  return (
    <section aria-labelledby="ws-ask-title" className="ask">
      <h2 id="ws-ask-title">Ask about the fossil</h2>
      <div className="ws-label">Ask about this bone</div>
      <ExplainSection specimen={specimen} />
      <div className="ws-line" />
      <div className="ws-label">Guided tour</div>
      <TourSection specimen={specimen} />
      <div className="ws-line" />
      <div className="ws-label">Observation helper</div>
      <FollowupSection specimen={specimen} />
    </section>
  )
}
