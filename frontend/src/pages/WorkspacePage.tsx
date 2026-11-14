import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AssetStatusList } from "../components/AssetStatusList"
import { PinObservationDock } from "../components/PinObservationDock"
import { SpecimenInfoPanel } from "../components/SpecimenInfoPanel"
import {
  loadSpecimenPayload,
  type SpecimenCredits,
} from "../specimen"
import type { SpecimenStructure } from "../types/specimenAssets"
import { useViewerStore } from "../store/viewerStore"

/**
 * Workspace after Start.
 * Task 1: open specimen id
 * Task 2: §5 info panel
 * Task 3: honest missing/unreadable structure status
 * Task 4: pin observations (localStorage, bone-space points)
 * Three.js stage stays Ananya’s — she writes selection + bone-space picks.
 */
export function WorkspacePage() {
  // Read :specimenId from the URL (/workspace/ypm-vp-41198)
  const { specimenId } = useParams<{ specimenId: string }>()

  // Shared store: specimen id + (later) selection/pick from Ananya
  const openSpecimen = useViewerStore((state) => state.openSpecimen)
  const closeSpecimen = useViewerStore((state) => state.closeSpecimen)
  const activeId = useViewerStore((state) => state.specimenId)

  // Task 2 attribution object
  const [credits, setCredits] = useState<SpecimenCredits | null>(null)
  // Task 3 structure inventory with ok / missing / unreadable
  const [structures, setStructures] = useState<SpecimenStructure[]>([])
  // Error message if the id is unknown or load fails
  const [error, setError] = useState<string | null>(null)
  // true until loadSpecimenPayload finishes
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Guard: route without an id
    if (!specimenId) {
      setError("Missing specimen id in the URL.")
      setLoading(false)
      return
    }

    // Sync URL → Zustand (also clears old selection/pick)
    openSpecimen(specimenId)

    // Ignore results if the visitor navigates away mid-request
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        // One payload: credits + structure statuses
        const data = await loadSpecimenPayload(specimenId!)
        if (!cancelled) {
          setCredits(data.credits)
          setStructures(data.structures)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load specimen.",
          )
          setCredits(null)
          setStructures([])
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

  // Only "ok" bones can be demo-picked / pinned until real meshes arrive
  const demoStructures = structures
    .filter((row) => row.status === "ok")
    .map((row) => ({
      id: row.id,
      label:
        row.side === "none"
          ? row.displayName
          : `${row.displayName} (${row.side})`,
    }))

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
        Ananya’s React Three Fiber / Three.js canvas mounts here.
        On mesh click she should call:
          setSelectedStructure(structureId, label)
          setBoneSpacePick({ x, y, z })  // bone-local, not world/exploded
      */}
      <section className="specimen-stage" aria-label="Specimen study area">
        <p className="stage-placeholder">
          3D viewer slot — active specimen id:{" "}
          <code>{activeId ?? "none"}</code>
          {" · "}
          {structures.filter((row) => row.status === "ok").length} ready
          mesh(es)
        </p>
      </section>

      {/* Right column: credits + asset status */}
      <div className="workspace-side">
        {credits && <SpecimenInfoPanel credits={credits} />}
        {!loading && !error && <AssetStatusList structures={structures} />}
      </div>

      {/*
        Task 4: bottom pin dock (spec §3.1 — Pin observation near the canvas).
        Restores localStorage pins for this specimenId on mount.
      */}
      {specimenId && !loading && !error && (
        <PinObservationDock
          specimenId={specimenId}
          demoStructures={demoStructures}
        />
      )}
    </main>
  )
}
