import { create } from "zustand"

/**
 * Shared viewer state (Zustand).
 *
 * Alexandra’s pin notes (§2) should key off `specimenId` so reopening
 * the same specimen in this browser can restore localStorage pins.
 * Ananya’s Three.js scene can read the same store for selection later.
 */
type ViewerState = {
  /** null = visitor is still on the start screen */
  specimenId: string | null
  /** Call this when the curated Start button (or a route) opens a study */
  openSpecimen: (id: string) => void
  /** Call this to leave the workspace and clear the active id */
  closeSpecimen: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  specimenId: null,
  openSpecimen: (id) => set({ specimenId: id }),
  closeSpecimen: () => set({ specimenId: null }),
}))
