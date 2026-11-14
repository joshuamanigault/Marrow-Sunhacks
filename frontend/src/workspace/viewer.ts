import { create } from 'zustand'

// The shell reads and drives viewer state only through this file.
// Shape mirrors the state API in docs/roadmap.md (Ananya, task 8).

export type DisplayMode = 'solid' | 'xray' | 'exploded'

export interface ViewerState {
  selectedId: string | null
  /** Absent id = visible. */
  hiddenIds: Record<string, true>
  mode: DisplayMode
  /** 0..1. The scene renders parts assembled unless mode is 'exploded'. */
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

// INTEGRATION: replace this stub with Ananya's store export.
// The real store also frames the bone on focus(), turns the camera on
// rotateBy(), and restores the initial camera on reset().
export const useViewer = create<ViewerState>()((set) => ({
  ...initial,
  select: (id) => set({ selectedId: id }),
  setVisible: (id, visible) =>
    set((s) => {
      const { [id]: _, ...rest } = s.hiddenIds
      return { hiddenIds: visible ? rest : { ...rest, [id]: true } }
    }),
  focus: (id) => set({ selectedId: id }),
  // Entering Exploded at zero separation would look like nothing happened.
  setMode: (mode) =>
    set((s) => ({
      mode,
      separation: mode === 'exploded' && s.separation === 0 ? 0.5 : s.separation,
    })),
  setSeparation: (value) => set({ separation: Math.min(1, Math.max(0, value)) }),
  setColorByStructure: (on) => set({ colorByStructure: on }),
  rotateBy: () => {},
  reset: () => set(initial),
}))
