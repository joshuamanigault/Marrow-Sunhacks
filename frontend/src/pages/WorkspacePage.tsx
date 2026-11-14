import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import type { ApiReachability } from "../api/health"
import { AssetStatusList } from "../components/AssetStatusList"
import { PinObservationDock } from "../components/PinObservationDock"
import { SpecimenInfoPanel } from "../components/SpecimenInfoPanel"
import { StatusBanner } from "../components/StatusBanner"
import {
  loadSpecimenPayload,
  type SpecimenCredits,
} from "../specimen"
import { STATUS_COPY } from "../statusCopy"
import type { SpecimenStructure } from "../types/specimenAssets"
import { useViewerStore } from "../store/viewerStore"

/**
 * Workspace after Start.
 * Tasks 1–5 plus task 6 plain-language empty/error states:
 * API down, mesh fail / none ready, load error; pin empty lives in the dock.
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
  // Task 6: did /health succeed?
  const [apiStatus, setApiStatus] = useState<ApiReachability>("skipped")
  // Task 6: plain-language load failure (unknown id, etc.)
  const [loadError, setLoadError] = useState<string | null>(null)
  // true until loadSpecimenPayload finishes
  const [loading, setLoading] = useState(true)
  // Bump this to re-run the load (Try again on API-down banner)
  const [retryCount, setRetryCount] = useState(0)

  const retryLoad = useCallback(() => {
    setRetryCount((n) => n + 1)
  }, [])

  useEffect(() => {
    // Guard: route without an id
    if (!specimenId) {
      setLoadError(STATUS_COPY.loadErrorBody)
      setLoading(false)
      return
    }

    // Sync URL → Zustand (also clears old selection/pick)
    openSpecimen(specimenId)

    // Ignore results if the visitor navigates away mid-request
    let cancelled = false

    async function run() {
      setLoading(true)
      setLoadError(null)
      try {
        // Payload + API reachability for task 6 banners
        const result = await loadSpecimenPayload(specimenId!)
        if (!cancelled) {
          setCredits(result.payload.credits)
          setStructures(result.payload.structures)
          setApiStatus(result.apiStatus)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : STATUS_COPY.loadErrorBody,
          )
          setCredits(null)
          setStructures([])
          setApiStatus("down")
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
  }, [specimenId, openSpecimen, retryCount])

  // Mesh health derived from Joshua-style status rows (honest, no fake art)
  const readyMeshes = structures.filter((row) => row.status === "ok")
  const problemMeshes = structures.filter(
    (row) => row.status === "missing" || row.status === "unreadable",
  )
  const showMeshFail = !loading && !loadError && problemMeshes.length > 0
  const showMeshNone =
    !loading && !loadError && structures.length > 0 && readyMeshes.length === 0

  // Only "ok" bones can be demo-picked / pinned until real meshes arrive
  const demoStructures = readyMeshes.map((row) => ({
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

        {loading && (
          <p className="workspace-status">{STATUS_COPY.loading}</p>
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

      {/* Task 6 banners — plain language, above the 3D stage */}
      <div className="workspace-banners">
        {loadError && (
          <StatusBanner
            kind="error"
            title={STATUS_COPY.loadErrorTitle}
            onRetry={retryLoad}
          >
            {loadError}
          </StatusBanner>
        )}

        {!loading && !loadError && apiStatus === "down" && (
          <StatusBanner
            kind="warning"
            title={STATUS_COPY.apiDownTitle}
            onRetry={retryLoad}
          >
            {STATUS_COPY.apiDownBody}
          </StatusBanner>
        )}

        {showMeshNone && (
          <StatusBanner kind="warning" title={STATUS_COPY.meshNoneTitle}>
            {STATUS_COPY.meshNoneBody}
          </StatusBanner>
        )}

        {showMeshFail && !showMeshNone && (
          <StatusBanner kind="warning" title={STATUS_COPY.meshFailTitle}>
            {STATUS_COPY.meshFailBody}
          </StatusBanner>
        )}
      </div>

      {/*
        Ananya’s React Three Fiber / Three.js canvas mounts here.
        On mesh click she should call:
          setSelectedStructure(structureId, label)
          setBoneSpacePick({ x, y, z })  // bone-local, not world/exploded
      */}
      <section className="specimen-stage" aria-label="Specimen study area">
        {showMeshNone ? (
          <StatusBanner kind="empty" title={STATUS_COPY.meshNoneTitle}>
            {STATUS_COPY.meshNoneBody}
          </StatusBanner>
        ) : (
          <p className="stage-placeholder">
            3D viewer slot — active specimen id:{" "}
            <code>{activeId ?? "none"}</code>
            {" · "}
            {readyMeshes.length} ready mesh(es)
            {problemMeshes.length > 0
              ? ` · ${problemMeshes.length} unavailable`
              : ""}
          </p>
        )}
      </section>

      {/* Right column: credits + asset status */}
      <div className="workspace-side">
        {credits && <SpecimenInfoPanel credits={credits} />}
        {!loading && !loadError && <AssetStatusList structures={structures} />}
      </div>

      {/*
        Task 4 + 6: pin dock (includes polished "no pins yet" empty state).
      */}
      {specimenId && !loading && !loadError && (
        <PinObservationDock
          specimenId={specimenId}
          demoStructures={demoStructures}
        />
      )}
    </main>
  )
}
