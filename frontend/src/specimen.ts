/**
 * Curated specimen identity, attribution, and structure inventory loader.
 *
 * Task 1–2: id + §5 credits for Alex’s info panel.
 * Task 3: structure rows with ok / missing / unreadable (honest status).
 *
 * Same id (`ypm-vp-41198`) for pins (§2) and Three.js (Ananya).
 */

import { CURATED_STRUCTURES } from "./curatedStructures"
import type { SpecimenStructure } from "./types/specimenAssets"

/** Stable id the whole app uses to open this specimen. */
export const CURATED_SPECIMEN_ID = "ypm-vp-41198"

/**
 * Shape of content for Alex’s Specimen information panel.
 * Each field maps to something a museum visitor should be able to repeat.
 */
export type SpecimenCredits = {
  /** Same id as the start button / URL / pin storage key */
  id: string
  /** Scientific name of the animal (italicize in the UI) */
  scientificName: string
  /** Plain-language label — not a new species claim */
  commonLabel: string
  /** Museum accession number visitors cite */
  accession: string
  /** Holding institution */
  collection: string
  /** Geologic age from the study context */
  period: string
  /** Where the fossil was found */
  locality: string
  /** Short data-source line for the header */
  dataSource: string
  /** Named researchers who deposited the study */
  researchers: string[]
  /** Full citation string for the info panel */
  citation: string
  /** Clickable Dryad / DOI link */
  citationUrl: string
  /** License / reuse note (Dryad reports CC0-1.0) */
  reuse: string
  /**
   * “What you’re looking at” — only claims grounded in the published
   * inventory (micro-CT + named skull-element meshes). No fake bones.
   */
  blurb: string
}

/** Full payload shape Joshua’s API should eventually return */
export type SpecimenPayload = {
  credits: SpecimenCredits
  structures: SpecimenStructure[]
}

/** Credits + copy shown in Alex’s info panel after open. */
export const CURATED_SPECIMEN_CREDITS: SpecimenCredits = {
  // Must match CURATED_SPECIMEN_ID so reopen/pins use one key
  id: CURATED_SPECIMEN_ID,

  // Animal (spec §5 first candidate)
  scientificName: "Eosphorosuchus lacrimosa",
  commonLabel: "Extinct archosauriform (skull study)",

  // Museum accession visitors should be able to find again
  accession: "YPM VP 41198",
  collection: "Yale Peabody Museum",

  // Context from the curated study / preview metadata
  period: "Late Triassic",
  locality: "Ghost Ranch, New Mexico",

  // Source line for the floating header
  dataSource: "Dryad · CC0 1.0",

  // Researcher credits (authors on the Dryad deposit)
  researchers: [
    "Margulis-Ohnuma",
    "Ruebenstahl",
    "Meyer",
    "Bhullar",
  ],

  // Citation text + live Dryad link (spec §5)
  citation:
    "Margulis-Ohnuma, Ruebenstahl, Meyer & Bhullar (2026). Data from: Eosphorosuchus lacrimosa micro-CT and skull-element meshes. Dryad. https://doi.org/10.5061/dryad.q83bk3jvv",
  citationUrl: "https://datadryad.org/dataset/doi%3A10.5061/dryad.q83bk3jvv",

  // Reuse terms from Dryad metadata research notes
  reuse:
    "CC0 1.0. Keep specimen identifiers and this citation visible in the app.",

  // Grounded blurb: Appendix 1 = CT stack, Appendix 2 = skull STLs.
  // Do not name bones that are not in the prepared inventory.
  blurb:
    "You are looking at prepared 3D surfaces of skull elements that the researchers extracted from a published micro-CT study of this Yale Peabody specimen. The Dryad deposit lists a CT TIFF stack (Appendix 1) and separately named skull-element meshes (Appendix 2). Marrow shows those researcher-prepared meshes — not an artist reconstruction, and not invented anatomy.",
}

/**
 * Load credits + structure inventory for a specimen id.
 * Today: local curated stub. Later: Joshua’s GET /specimens/:id
 */
export async function loadSpecimenPayload(
  specimenId: string,
): Promise<SpecimenPayload> {
  // Small delay so beginners can see loading → ready in the UI
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Only the curated demo id is supported until Joshua’s API lands
  if (specimenId !== CURATED_SPECIMEN_ID) {
    throw new Error(`Unknown specimen id: ${specimenId}`)
  }

  // Credits (task 2) + structure statuses (task 3) together
  return {
    credits: CURATED_SPECIMEN_CREDITS,
    structures: CURATED_STRUCTURES,
  }
}

/**
 * Convenience wrapper if you only need §5 credits.
 */
export async function loadSpecimenCredits(
  specimenId: string,
): Promise<SpecimenCredits> {
  const payload = await loadSpecimenPayload(specimenId)
  return payload.credits
}
