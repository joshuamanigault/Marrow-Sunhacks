/**
 * Pin observation shape (Alexandra roadmap task 4 / spec §2 pin row).
 *
 * Critical rule from the spec:
 * store the point in BONE SPACE (on the selected structure),
 * not screen pixels, not camera space, not exploded world offset.
 * Then explode → reassemble → reset keep the pin on the same anatomy.
 */

/** x/y/z on the bone’s local axes (Ananya’s Three.js pick supplies this) */
export type BoneSpacePoint = {
  x: number
  y: number
  z: number
}

/** One anonymous note pinned to a bone for one specimen */
export type PinObservation = {
  /** Unique id for this note inside localStorage */
  id: string
  /** Specimen this pin belongs to (e.g. ypm-vp-41198) */
  specimenId: string
  /** Structure / bone id from Joshua’s inventory + Ananya’s selection */
  structureId: string
  /** Optional display label for the bone (UI only) */
  structureLabel: string
  /** Point in bone-local coordinates — survives explode/reset */
  boneSpacePoint: BoneSpacePoint
  /** Visitor’s short observation text */
  note: string
  /** ISO timestamp when the pin was saved in this browser */
  createdAt: string
}
