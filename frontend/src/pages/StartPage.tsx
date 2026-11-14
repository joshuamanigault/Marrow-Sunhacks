import { Link } from "react-router-dom"
import { CURATED_SPECIMEN_ID } from "../specimen"
import { useViewerStore } from "../store/viewerStore"

/**
 * Roadmap task 1 — Start / open specimen
 * One curated entry point that loads Joshua’s specimen id into the workspace.
 */
export function StartPage() {
  // Grab the action that records which specimen is open.
  const openSpecimen = useViewerStore((state) => state.openSpecimen)

  return (
    <main className="start-page">
      {/* Brand first (product name is the hero signal). */}
      <p className="brand">Marrow</p>

      <h1 className="start-title">Open a curated fossil specimen</h1>

      <p className="start-lead">
        Explore real CT-derived skull anatomy from one published study — no
        upload, no sign-in.
      </p>

      {/*
        Curated button: navigates to /workspace/ypm-vp-41198
        and also writes that id into Zustand for pins / Three.js.
      */}
      <Link
        className="start-cta"
        to={`/workspace/${CURATED_SPECIMEN_ID}`}
        onClick={() => openSpecimen(CURATED_SPECIMEN_ID)}
      >
        Open YPM VP 41198
      </Link>

      <p className="start-meta">
        Specimen id: <code>{CURATED_SPECIMEN_ID}</code>
      </p>
    </main>
  )
}
