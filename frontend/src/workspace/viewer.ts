import { create } from 'zustand'

// The shell reads and drives viewer state only through this file.
// Shape mirrors the state API in docs/roadmap.md (Ananya, task 8).
// The 3D scene (src/viewer/) reads this state and answers camera requests.

export type DisplayMode = 'solid' | 'xray' | 'exploded'

/** Point on a bone in that bone's own (specimen / source STL) space. */
export interface Pick {
  structureId: string
  point: [number, number, number]
}

/**
 * One-shot camera instruction for the scene. `seq` increases on every request
 * so the same request twice in a row (two Rotate clicks) still fires.
 */
export type CameraRequest =
  | { seq: number; kind: 'focus'; id: string }
  | { seq: number; kind: 'rotate'; radians: number }
  | { seq: number; kind: 'reset' }

export interface ViewerState {
  selectedId: string | null
  /** Absent id = visible. */
  hiddenIds: Record<string, true>
  mode: DisplayMode
  /** 0..1. Always 0 unless mode is 'exploded'. */
  separation: number
  colorByStructure: boolean
  /**
   * Last point the visitor picked on a bone, in that bone's own space, so it is
   * independent of camera and explode offset. The scene sets it; the pin flow
   * reads it.
   */
  pick: Pick | null
  /**
   * Bone the visitor is studying in isolation: it stays solid and in place while
   * every other bone explodes away from it and turns translucent. Null = off.
   */
  focusedId: string | null
  /** Latest camera instruction. Only the scene reads this. */
  camera: CameraRequest | null
  select(id: string | null): void
  setVisible(id: string, visible: boolean): void
  /** Isolate a bone (zoom, explode the rest, fade the rest). Same id again exits. */
  focus(id: string): void
  setMode(mode: DisplayMode): void
  setSeparation(value: number): void
  setColorByStructure(on: boolean): void
  rotateBy(radians: number): void
  reset(): void
  /** Scene only: a click landed on a bone. Selects it and records the point. */
  setPick(pick: Pick): void
}

const initial = {
  selectedId: null,
  hiddenIds: {},
  mode: 'solid',
  separation: 0,
  colorByStructure: true,
  pick: null,
  focusedId: null,
} satisfies Partial<ViewerState>

function without(hiddenIds: Record<string, true>, id: string) {
  const { [id]: _, ...rest } = hiddenIds
  return rest
}

let seq = 0

/** Separation used when focus starts, unless the visitor already chose one. */
const FOCUS_SEPARATION = 0.6

/** While a bone is focused, choosing a different bone moves the focus to it. */
function followFocus(s: ViewerState, id: string | null) {
  if (!s.focusedId || id === s.focusedId) return {}
  if (!id) return { focusedId: null, camera: { seq: ++seq, kind: 'reset' } as const }
  return { focusedId: id, camera: { seq: ++seq, kind: 'focus', id } as const }
}

/** Clear focus; if one was active, also reset the camera to the home view. */
function leaveFocus(s: ViewerState) {
  return s.focusedId
    ? { focusedId: null as null, camera: { seq: ++seq, kind: 'reset' } as const }
    : { focusedId: null as null }
}

export const useViewer = create<ViewerState>()((set) => ({
  ...initial,
  camera: null,
  // The selected structure is always visible: selecting shows it, hiding deselects it.
  // A pick only belongs to the bone it was made on.
  select: (id) =>
    set((s) => ({
      selectedId: id,
      hiddenIds: id ? without(s.hiddenIds, id) : s.hiddenIds,
      pick: s.pick && s.pick.structureId === id ? s.pick : null,
      ...followFocus(s, id),
    })),
  setVisible: (id, visible) =>
    set((s) => {
      const deselect = !visible && s.selectedId === id
      // Hiding the focused bone exits focus the same way a second Focus press does.
      const unfocus = !visible && s.focusedId === id
      return {
        hiddenIds: visible ? without(s.hiddenIds, id) : { ...s.hiddenIds, [id]: true },
        selectedId: deselect ? null : s.selectedId,
        pick: deselect ? null : s.pick,
        focusedId: unfocus ? null : s.focusedId,
        ...(unfocus
          ? { mode: 'solid' as const, separation: 0, camera: { seq: ++seq, kind: 'reset' as const } }
          : {}),
      }
    }),
  focus: (id) =>
    set((s) =>
      s.focusedId === id
        ? // Second press: reassemble and go back to the home view.
          { focusedId: null, mode: 'solid', separation: 0, camera: { seq: ++seq, kind: 'reset' } }
        : {
            focusedId: id,
            selectedId: id,
            hiddenIds: without(s.hiddenIds, id),
            pick: s.pick && s.pick.structureId === id ? s.pick : null,
            mode: 'exploded',
            separation: s.mode === 'exploded' && s.separation ? s.separation : FOCUS_SEPARATION,
            camera: { seq: ++seq, kind: 'focus', id },
          },
    ),
  // Separation is non-zero only in Exploded, so the scene can position parts
  // from `separation` alone. Entering Exploded starts at 50% so it is visible.
  // Picking a display mode by hand leaves focus (and resets the camera if focused).
  setMode: (mode) =>
    set((s) => ({
      mode,
      separation: mode === 'exploded' ? s.separation || 0.5 : 0,
      ...leaveFocus(s),
    })),
  setSeparation: (value) =>
    set((s) =>
      s.mode === 'exploded' && Number.isFinite(value)
        ? { separation: Math.min(1, Math.max(0, value)) }
        : s,
    ),
  setColorByStructure: (on) => set({ colorByStructure: on }),
  rotateBy: (radians) => set({ camera: { seq: ++seq, kind: 'rotate', radians } }),
  // Restores the initial display and camera. Pins live elsewhere and are kept.
  reset: () => set({ ...initial, camera: { seq: ++seq, kind: 'reset' } }),
  setPick: (pick) =>
    set((s) => ({
      pick,
      selectedId: pick.structureId,
      hiddenIds: without(s.hiddenIds, pick.structureId),
      ...followFocus(s, pick.structureId),
    })),
}))
