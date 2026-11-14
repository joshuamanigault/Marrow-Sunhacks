import { create } from 'zustand'

// The shell reads and drives viewer state only through this file.
// Shape mirrors the state API in docs/roadmap.md (Ananya, task 8).

export type DisplayMode = 'solid' | 'xray' | 'exploded'

export interface ViewerState {
  selectedId: string | null
  /** Absent id = visible. */
  hiddenIds: Record<string, true>
  mode: DisplayMode
  /** 0..1. Always 0 unless mode is 'exploded'. */
  separation: number
  colorByStructure: boolean
  select(id: string | null): void
  setVisible(id: string, visible: boolean): void
  focus(id: string): void
  setMode(mode: DisplayMode): void
  setSeparation(value: number): void
  setColorByStructure(on: boolean): void
  rotateBy(radians: number): void
  reset(): void
}

const initial = {
  selectedId: null,
  hiddenIds: {},
  mode: 'solid',
  separation: 0,
  colorByStructure: true,
} satisfies Partial<ViewerState>

function without(hiddenIds: Record<string, true>, id: string) {
  const { [id]: _, ...rest } = hiddenIds
  return rest
}

// INTEGRATION: replace this stub with Ananya's store export.
// The real store also frames the bone on focus(), turns the camera on
// rotateBy(), and restores the initial camera on reset().
export const useViewer = create<ViewerState>()((set) => ({
  ...initial,
  // The selected structure is always visible: selecting shows it, hiding deselects it.
  select: (id) =>
    set((s) => ({ selectedId: id, hiddenIds: id ? without(s.hiddenIds, id) : s.hiddenIds })),
  setVisible: (id, visible) =>
    set((s) => ({
      hiddenIds: visible ? without(s.hiddenIds, id) : { ...s.hiddenIds, [id]: true },
      selectedId: !visible && s.selectedId === id ? null : s.selectedId,
    })),
  focus: (id) => set((s) => ({ selectedId: id, hiddenIds: without(s.hiddenIds, id) })),
  // Separation is non-zero only in Exploded, so the scene can position parts
  // from `separation` alone. Entering Exploded starts at 50% so it is visible.
  setMode: (mode) =>
    set((s) => ({ mode, separation: mode === 'exploded' ? s.separation || 0.5 : 0 })),
  setSeparation: (value) => set({ separation: Math.min(1, Math.max(0, value)) }),
  setColorByStructure: (on) => set({ colorByStructure: on }),
  rotateBy: () => {},
  reset: () => set(initial),
}))
