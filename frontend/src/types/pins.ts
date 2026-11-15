/**
 * Pin observation shape (Alexandra task 4 / spec §2 pin row).
 * Point is bone-space [x,y,z] — same shape as useViewer().pick.point.
 */

export type BoneSpacePoint = [number, number, number]

export type PinObservation = {
  id: string
  specimenId: string
  structureId: string
  structureLabel: string
  /** Bone-local coordinates — survives explode / reassemble / reset */
  boneSpacePoint: BoneSpacePoint
  note: string
  createdAt: string
}
