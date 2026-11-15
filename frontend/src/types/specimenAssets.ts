/**
 * Asset status types for Joshua’s specimen payload (roadmap).
 *
 * Spec §2 “Opens the specimen”:
 * missing/unreadable parts are identified — never replaced with an illustration.
 *
 * Alexandra task 3 shows these statuses in the UI.
 * Ananya’s Three.js should only try to load rows with status "ok".
 */

/** Exactly three allowed values from Joshua’s inventory contract */
export type AssetStatus = "ok" | "missing" | "unreadable"

/**
 * One row = one prepared structure (usually one mesh file).
 * Left vs right stay separate ids (spec: left/right maxillae).
 */
export type SpecimenStructure = {
  /** Stable id for Three.js selection + future pins */
  id: string
  /** Visitor-facing name */
  displayName: string
  /** Anatomical side when it matters; otherwise "none" */
  side: "left" | "right" | "none"
  /** Original filename from the study inventory (evidence trail) */
  sourceFilename: string
  /** Whether the browser can show this mesh honestly */
  status: AssetStatus
  /**
   * Public URL for an ok mesh.
   * Always null when status is missing or unreadable —
   * so we never point Three.js at a fake stand-in file.
   */
  meshUrl: string | null
  /** Optional swatch color when the structure is loadable */
  color: string | null
}
