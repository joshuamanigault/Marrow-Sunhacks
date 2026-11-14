import type { AssetStatus, SpecimenStructure } from "../types/specimenAssets"

/**
 * Honest asset status list (Alexandra roadmap task 3).
 *
 * Spec §2: if a part is missing or unreadable, say so in the list / notice.
 * Never substitute an illustration or fake 3D stand-in.
 *
 * This is shell UI next to Three.js — Ananya only loads status === "ok".
 */
type AssetStatusListProps = {
  // Structures from the specimen payload (Joshua later; stub today)
  structures: SpecimenStructure[]
}

export function AssetStatusList({ structures }: AssetStatusListProps) {
  // Rows that cannot be shown as real meshes
  const problemRows = structures.filter(
    (row) => row.status === "missing" || row.status === "unreadable",
  )

  // How many meshes Three.js is allowed to attempt
  const okCount = structures.filter((row) => row.status === "ok").length

  return (
    <section className="asset-status" aria-label="Prepared structure status">
      {/* Section title for Alex’s anatomy / status area */}
      <h2 className="asset-status-heading">Prepared structures</h2>

      {/* Small notice only when something is not ok */}
      {problemRows.length > 0 && (
        <p className="asset-status-notice" role="status">
          {problemRows.length} of {structures.length} listed parts are not
          available to display ({okCount} ready). Marrow will not invent
          replacement art for missing or unreadable meshes.
        </p>
      )}

      {/* All-clear notice when every row is ok */}
      {problemRows.length === 0 && structures.length > 0 && (
        <p className="asset-status-notice asset-status-notice--ok" role="status">
          All {structures.length} listed parts are marked ready to load.
        </p>
      )}

      {/* Empty inventory (should be rare) */}
      {structures.length === 0 && (
        <p className="asset-status-notice" role="status">
          No structure inventory was provided for this specimen yet.
        </p>
      )}

      {/* One list row per structure — status text, never an image fallback */}
      <ul className="asset-status-list">
        {structures.map((row) => (
          <li key={row.id} className="asset-status-row">
            {/* Color swatch only for ok rows that have a color */}
            <span
              className="asset-status-swatch"
              style={{
                backgroundColor:
                  row.status === "ok" && row.color ? row.color : "transparent",
              }}
              aria-hidden="true"
            />

            {/* Name + optional side label */}
            <div className="asset-status-copy">
              <span className="asset-status-name">
                {formatStructureLabel(row)}
              </span>
              <span className="asset-status-source">{row.sourceFilename}</span>
            </div>

            {/* Plain-language status badge */}
            <span
              className={`asset-status-badge asset-status-badge--${row.status}`}
            >
              {statusLabel(row.status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Turn status enum into visitor-facing words */
function statusLabel(status: AssetStatus): string {
  if (status === "ok") {
    return "Ready"
  }
  if (status === "missing") {
    return "Missing"
  }
  // status === "unreadable"
  return "Unreadable"
}

/** "Maxilla (left)" when side matters; otherwise just the display name */
function formatStructureLabel(row: SpecimenStructure): string {
  if (row.side === "none") {
    return row.displayName
  }
  return `${row.displayName} (${row.side})`
}
