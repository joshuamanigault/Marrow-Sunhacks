import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  loadSpecimenCredits,
  type SpecimenCredits,
} from "../specimen"
import { useViewerStore } from "../store/viewerStore"

/**
 * Workspace after Start.
 * Syncs the URL specimen id into Zustand, loads §5 credits,
 * and leaves a clear slot where Ananya’s Three.js canvas will mount.
 */
export function WorkspacePage() {
  // React Router puts :specimenId from the path into params.
  const { specimenId } = useParams<{ specimenId: string }>()

  // Zustand actions / values used by pins later.
  const openSpecimen = useViewerStore((state) => state.openSpecimen)
  const closeSpecimen = useViewerStore((state) => state.closeSpecimen)
  const activeId = useViewerStore((state) => state.specimenId)

  // Local UI state for the credits fetch.
  const [credits, setCredits] = useState<SpecimenCredits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No id in the URL → nothing to open.
    if (!specimenId) {
      setError("Missing specimen id in the URL.")
      setLoading(false)
      return
    }

    // Keep Zustand in sync (needed if someone bookmarks / refreshes).
    openSpecimen(specimenId)

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        // Today: stub. Later: Joshua’s GET /specimens/:id
        const data = await loadSpecimenCredits(specimenId!)
        if (!cancelled) {
          setCredits(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load specimen.")
          setCredits(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    // Cleanup if the visitor navigates away mid-load.
    return () => {
      cancelled = true
    }
  }, [specimenId, openSpecimen])

  return (
    <main className="workspace-page">
      {/* Floating-style header: animal + accession + source (spec §3.1). */}
      <header className="workspace-header">
        <p className="brand brand--compact">Marrow</p>

        {loading && <p className="workspace-status">Loading specimen…</p>}

        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}

        {credits && (
          <div className="specimen-identity">
            <h1 className="specimen-name">
              <em>{credits.scientificName}</em>
            </h1>
            <p className="specimen-accession">{credits.accession}</p>
            <p className="specimen-source">
              {credits.collection} ·{" "}
              <a href={credits.citationUrl} target="_blank" rel="noreferrer">
                {credits.dataSource}
              </a>
            </p>
          </div>
        )}

        <Link
          className="back-link"
          to="/"
          onClick={() => closeSpecimen()}
        >
          ← Back to start
        </Link>
      </header>

      {/*
        Ananya’s React Three Fiber canvas goes here.
        Keep bone picks in specimen/bone space for Alexandra’s pins.
      */}
      <section
        className="specimen-stage"
        aria-label="Specimen study area"
      >
        <p className="stage-placeholder">
          3D viewer slot — active specimen id:{" "}
          <code>{activeId ?? "none"}</code>
        </p>
      </section>

      {/* §5 credits block — attribution stays visible with the study. */}
      {credits && (
        <aside className="credits-panel" aria-label="Specimen information">
          <h2>Specimen information</h2>
          <dl className="credits-list">
            <dt>Period</dt>
            <dd>{credits.period}</dd>
            <dt>Locality</dt>
            <dd>{credits.locality}</dd>
            <dt>Citation</dt>
            <dd>{credits.citation}</dd>
            <dt>Reuse</dt>
            <dd>{credits.reuse}</dd>
          </dl>
          <p className="credits-blurb">{credits.blurb}</p>
          <p className="pin-hint">
            Pins (roadmap task 4) will save under localStorage key tied to{" "}
            <code>{credits.id}</code> in this browser only.
          </p>
        </aside>
      )}
    </main>
  )
}
