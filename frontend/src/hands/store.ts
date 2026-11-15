import { create } from 'zustand'
import type { GestureKind, Point2 } from './gestures'

// Hand state updates ~30 times a second, so it lives apart from the viewer
// store: only the overlay and the scene's pointer read it, not the whole shell.

export type HandStatus = 'off' | 'loading' | 'on' | 'error'

interface HandState {
  status: HandStatus
  error: string | null
  gesture: GestureKind
  /** Cursor over the scene, 0..1, while pointing. */
  pointer: Point2 | null
  /** Bone under the cursor. */
  hoverId: string | null
  /** 0..1 progress of holding still on hoverId; at 1 it gets selected. */
  dwell: number
}

export const useHands = create<HandState>()(() => ({
  status: 'off',
  error: null,
  gesture: 'none',
  pointer: null,
  hoverId: null,
  dwell: 0,
}))

// Pinch rotation is consumed every frame by the camera rig; a plain accumulator
// avoids re-rendering anything for it.
const pending = { azimuth: 0, polar: 0 }

export function addRotation(azimuth: number, polar: number) {
  pending.azimuth += azimuth
  pending.polar += polar
}

export function takeRotation(): { azimuth: number; polar: number } | null {
  if (pending.azimuth === 0 && pending.polar === 0) return null
  const out = { ...pending }
  pending.azimuth = 0
  pending.polar = 0
  return out
}
