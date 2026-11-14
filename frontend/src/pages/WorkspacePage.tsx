import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { SpecimenInfoPanel } from "../components/SpecimenInfoPanel"
import {
  loadSpecimenCredits,
  type SpecimenCredits,
} from "../specimen"
import { useViewerStore } from "../store/viewerStore"

/**
 * Workspace after Start (task 1).
 * Loads Joshua’s specimen id, shows §5 identity in the header,
 * mounts Alex’s Specimen information panel (task 2),
 * and leaves the 3D stage for Ananya’s Three.js canvas.
 */
export function WorkspacePage() {
  // Read :specimenId from the URL (/workspace/ypm-vp-41198)
  const { specimenId } = useParams<{ specimenId: string }>()

  // Shared store: same id pins will use in task 4
  const openSpecimen = useViewerStore((state) => state.openSpecimen)
  const closeSpecimen = useViewerStore((state) => state.closeSpecimen)
  const activeId = useViewerStore((state) => state.specimenId)

  // Holds the attribution object for the info panel (or null while loading)
  const [credits, setCredits] = useState<SpecimenCredits | null>(null)
  // Error message if the id is unknown or load fails
  const [error, setError] = useState<string | null>(null)
  // true until loadSpecimenCredits finishes
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Guard: route without an id
    if (!specimenId) {
      setError("Missing specimen id in the URL.")
      setLoading(false)
      return
    }

    // Sync URL → Zustand (refresh / bookmark still open the same study)
    openSpecimen(specimenId)

    // Ignore results if the visitor navigates away mid-request
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        // Task 2 data: animal, accession, citation, researchers, blurb
        const data = await loadSpecimenCredits(specimenId!)
        if (!cancelled) {
          setCredits(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load specimen.",
          )
          setCredits(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [specimenId, openSpecimen])

  return (
    <main className="workspace-page">
      {/* Floating header: animal + accession + source (spec §3.1) */}
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
            {/* Animal name */}
            <h1 className="specimen-name">
              <em>{credits.scientificName}</em>
            </h1>
            {/* YPM accession */}
            <p className="specimen-accession">{credits.accession}</p>
            {/* Collection + Dryad shortcut */}
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
        Ananya’s React Three Fiber / Three.js canvas mounts here.
        Keep bone picks in specimen/bone space for Alexandra’s pins.
      */}
      <section className="specimen-stage" aria-label="Specimen study area">
        <p className="stage-placeholder">
          3D viewer slot — active specimen id:{" "}
          <code>{activeId ?? "none"}</code>
        </p>
      </section>

      {/*
        Task 2: Alex’s Specimen information panel content.
        When Alex’s tool rail exists, this same component can render
        inside that panel slot instead of the page column.
      */}
      {credits && <SpecimenInfoPanel credits={credits} />}
    </main>
  )
}
