import type { SpecimenStructure } from "./types/specimenAssets"

/**
 * Stub structure list for YPM VP 41198 until Joshua’s real inventory API lands.
 *
 * Why some rows are missing/unreadable:
 * task 3 must prove the UI tells the truth. These statuses are DEMO flags —
 * replace this array with Joshua’s payload; do not draw substitute art.
 *
 * Ids use the same specimen prefix as CURATED_SPECIMEN_ID in specimen.ts
 * ("ypm-vp-41198") without importing that file (avoids a circular import).
 *
 * Left/right maxillae stay separate (spec §5).
 *
 * Note: kept under src/ (not src/data/) because the repo gitignores data/.
 */
const SPECIMEN_ID = "ypm-vp-41198"

export const CURATED_STRUCTURES: SpecimenStructure[] = [
  {
    // Loadable example — Three.js may use meshUrl when Joshua hosts files
    id: `${SPECIMEN_ID}__maxilla-left`,
    displayName: "Maxilla",
    side: "left",
    sourceFilename: "maxilla_left.stl",
    status: "ok",
    // Placeholder path — Ananya swaps for Joshua’s real public URL
    meshUrl: "/assets/specimens/ypm-vp-41198/maxilla_left.glb",
    color: "#c5aa83",
  },
  {
    // Second side stays its own row (do not merge L+R because names match)
    id: `${SPECIMEN_ID}__maxilla-right`,
    displayName: "Maxilla",
    side: "right",
    sourceFilename: "maxilla_right.stl",
    status: "ok",
    meshUrl: "/assets/specimens/ypm-vp-41198/maxilla_right.glb",
    color: "#d4b88d",
  },
  {
    // Demo: file not in the prepared browser set yet
    id: `${SPECIMEN_ID}__nasal`,
    displayName: "Nasal",
    side: "none",
    sourceFilename: "nasal.stl",
    status: "missing",
    meshUrl: null, // honest: no URL, no illustration
    color: null,
  },
  {
    // Demo: file present in inventory but could not be converted/read
    id: `${SPECIMEN_ID}__jugal-left`,
    displayName: "Jugal",
    side: "left",
    sourceFilename: "jugal_left.stl",
    status: "unreadable",
    meshUrl: null, // honest: do not invent a mesh
    color: null,
  },
]
