/**
 * Curated specimen identity + attribution (Alexandra roadmap task 2).
 *
 * Spec §1 / §2 “Opens the specimen” / §5 credits:
 * a visitor must see the animal, museum accession, source, and researchers
 * without invented anatomy.
 *
 * Same id as task 1 (`ypm-vp-41198`) so pins (§2) and Three.js (Ananya)
 * stay keyed to one study. Swap the loader for Joshua’s API later —
 * keep this field shape so Alex’s info panel does not change.
 */

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
 * Load attribution for a specimen id.
 * Today: local curated object. Later: Joshua’s GET /specimens/:id
 */
export async function loadSpecimenCredits(
  specimenId: string,
): Promise<SpecimenCredits> {
  // Small delay so beginners can see loading → ready in the UI
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Only the curated demo id is supported until Joshua’s API lands
  if (specimenId !== CURATED_SPECIMEN_ID) {
    throw new Error(`Unknown specimen id: ${specimenId}`)
  }

  // Return the §5 content object for Alex’s panel
  return CURATED_SPECIMEN_CREDITS
}
