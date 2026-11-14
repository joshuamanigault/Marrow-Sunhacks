import { create } from "zustand"
import type { BoneSpacePoint } from "../types/pins"

/**
 * Shared viewer state (Zustand).
 *
 * Alexandra (pins): specimenId + selectedStructureId + boneSpacePick
 * Ananya (Three.js): writes selection + bone-space pick from raycasts
 * Alex (shell): can bind Reset / Pin dock to the same store later
 */

type ViewerState = {
  /** null = visitor is still on the start screen */
  specimenId: string | null
  /** Bone currently selected in the 3D scene (Ananya sets this) */
  selectedStructureId: string | null
  /** Optional label for the selected bone (for the pin form) */
  selectedStructureLabel: string | null
  /**
   * Last pick point in BONE SPACE for the selected structure.
   * Not screen XY. Not exploded world position.
   */
  boneSpacePick: BoneSpacePoint | null
  /** Open a specimen (clears selection/pick from the previous study) */
  openSpecimen: (id: string) => void
  /** Leave the workspace */
  closeSpecimen: () => void
  /** Ananya calls this when the visitor selects a bone */
  setSelectedStructure: (id: string | null, label?: string | null) => void
  /** Ananya calls this after a click/raycast on the bone surface */
  setBoneSpacePick: (point: BoneSpacePoint | null) => void
  /** Clear pick only (keep selection) — useful after saving a pin */
  clearBoneSpacePick: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  specimenId: null,
  selectedStructureId: null,
  selectedStructureLabel: null,
  boneSpacePick: null,

  openSpecimen: (id) =>
    set({
      specimenId: id,
      // New specimen → old selection/pick must not carry over
      selectedStructureId: null,
      selectedStructureLabel: null,
      boneSpacePick: null,
    }),

  closeSpecimen: () =>
    set({
      specimenId: null,
      selectedStructureId: null,
      selectedStructureLabel: null,
      boneSpacePick: null,
    }),

  setSelectedStructure: (id, label = null) =>
    set({
      selectedStructureId: id,
      selectedStructureLabel: label,
      // Changing bone clears the previous pick point
      boneSpacePick: null,
    }),

  setBoneSpacePick: (point) => set({ boneSpacePick: point }),

  clearBoneSpacePick: () => set({ boneSpacePick: null }),
}))
