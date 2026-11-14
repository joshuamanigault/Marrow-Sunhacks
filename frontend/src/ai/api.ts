// Client for the grounded AI routes (backend src/marrow/routes/ai.py).
// Every answer is built only from facts the server supplies; the viewer works without it.

import { useEffect, useState } from 'react'
import { apiUrl, type Specimen } from '../workspace/specimen'

export interface Fact {
  id: string
  text: string
  source: string
  url?: string | null
}

export interface ExplainResult {
  answer: string
  covered: boolean
  facts: Fact[]
  citation: Specimen['citation']
}

export interface TourResult {
  title: string
  steps: { structureId: string; caption: string; facts: Fact[] }[]
  citation: Specimen['citation']
}

export interface FollowupResult {
  question: string
  facts: Fact[]
  citation: Specimen['citation']
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('The server is not reachable.')
  }
  if (!res.ok) {
    const detail = await res.json().then((d: { detail?: unknown }) => d.detail, () => null)
    throw new Error(typeof detail === 'string' ? detail : `The server answered ${res.status}.`)
  }
  return res.json() as Promise<T>
}

export const explainBone = (specimenId: string, structureId: string, question: string | null, signal?: AbortSignal) =>
  post<ExplainResult>('/ai/explain', { specimenId, structureId, question }, signal)

export const planTour = (specimenId: string, topic: string, signal?: AbortSignal) =>
  post<TourResult>('/ai/tour', { specimenId, topic }, signal)

export const followUp = (specimenId: string, structureId: string, note: string, signal?: AbortSignal) =>
  post<FollowupResult>('/ai/followup', { specimenId, structureId, note }, signal)

/** True once the server confirms a Gemini key is configured; false otherwise or offline. */
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const req = new AbortController()
    fetch(apiUrl('/ai/status'), { signal: req.signal })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((s: { enabled?: boolean }) => setEnabled(!!s.enabled))
      .catch(() => {})
    return () => req.abort()
  }, [])
  return enabled
}
