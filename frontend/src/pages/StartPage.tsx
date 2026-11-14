import { Link } from 'react-router-dom'

/** Curated specimen id — must match Joshua’s API / Alex App constant. */
export const CURATED_SPECIMEN_ID = 'ypm-vp-41198'

/**
 * Simple entry (Alexandra task 1 / spec §2 “Opens the specimen”).
 * One curated button → workspace for Joshua’s specimen id.
 */
export function StartPage() {
  return (
    <main className="start-page">
      <p className="brand">Marrow</p>
      <h1 className="start-title">Open a curated fossil specimen</h1>
      <p className="start-lead">
        Explore real CT-derived skull anatomy from one published study — no
        upload, no sign-in.
      </p>
      <Link className="start-cta" to={`/workspace/${CURATED_SPECIMEN_ID}`}>
        Open YPM VP 41198
      </Link>
      <p className="start-meta">
        Specimen id: <code>{CURATED_SPECIMEN_ID}</code>
      </p>
    </main>
  )
}
