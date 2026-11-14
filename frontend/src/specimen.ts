/**
 * Curated specimen for the first Marrow demo.
 *
 * Spec §5 / roadmap: one real study — *Eosphorosuchus lacrimosa*,
 * Yale Peabody Museum YPM VP 41198 (Dryad dataset).
 *
 * Joshua owns the API + mesh files. Until his endpoint exists, we keep
 * the SAME id string everywhere (start button, URL, Zustand, pins).
 * When he publishes, swap the fetch URL — do not invent a second id.
 */

/** Stable id the whole app uses to open this specimen. */
export const CURATED_SPECIMEN_ID = "ypm-vp-41198"

/**
 * Local stub of the fields Alexandra needs for §5 credits / info panel.
 * Replace this object with data from Joshua’s specimen JSON when ready.
 */
export type SpecimenCredits = {
  id: string
  scientificName: string
  commonLabel: string
  accession: string
  collection: string
  period: string
  locality: string
  dataSource: string
  citation: string
  citationUrl: string
  reuse: string
  blurb: string
}

/** Credits shown after the visitor opens the curated specimen. */
export const CURATED_SPECIMEN_CREDITS: SpecimenCredits = {
  id: CURATED_SPECIMEN_ID,
  scientificName: "Eosphorosuchus lacrimosa",
  commonLabel: "Triassic archosauriform skull",
  accession: "YPM VP 41198",
  collection: "Yale Peabody Museum",
  period: "Late Triassic",
  locality: "Ghost Ranch, New Mexico",
  dataSource: "Dryad · CC0 1.0",
  citation:
    "Margulis-Ohnuma, Ruebenstahl, Meyer & Bhullar (2026). Dryad dataset doi:10.5061/dryad.q83bk3jvv",
  citationUrl: "https://datadryad.org/dataset/doi%3A10.5061/dryad.q83bk3jvv",
  reuse: "CC0 1.0 — retain specimen identifiers and citation in the app.",
  blurb:
    "Prepared skull-element meshes from a published micro-CT study. You are looking at researcher-extracted anatomy, not an illustration.",
}

/**
 * Later: call Joshua’s API, e.g. GET /specimens/ypm-vp-41198
 * For now we only accept the curated id and return the stub above.
 */
export async function loadSpecimenCredits(
  specimenId: string,
): Promise<SpecimenCredits> {
  // Pretend network delay so beginners see loading → ready.
  await new Promise((resolve) => setTimeout(resolve, 200))

  if (specimenId !== CURATED_SPECIMEN_ID) {
    throw new Error(`Unknown specimen id: ${specimenId}`)
  }

  return CURATED_SPECIMEN_CREDITS
}
