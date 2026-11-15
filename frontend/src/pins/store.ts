import { create } from 'zustand'
import type { PinObservation } from '../types/pins'
import { addPin as persistAdd, loadPins, removePin as persistRemove } from './storage'

/**
 * Shared pin list for in-scene 3D markers.
 * Persistence stays in storage.ts; this only keeps React in sync.
 */
interface PinsState {
  specimenId: string | null
  pins: PinObservation[]
  /** Which pin's callout is expanded in the scene. */
  activeId: string | null
  hydrate(specimenId: string): void
  add(pin: PinObservation): void
  remove(specimenId: string, pinId: string): void
  setActive(id: string | null): void
}

export const usePins = create<PinsState>()((set, get) => ({
  specimenId: null,
  pins: [],
  activeId: null,
  hydrate: (specimenId) =>
    set({ specimenId, pins: loadPins(specimenId), activeId: null }),
  add: (pin) =>
    set({ specimenId: pin.specimenId, pins: persistAdd(pin), activeId: pin.id }),
  remove: (specimenId, pinId) => {
    const pins = persistRemove(specimenId, pinId)
    set({
      specimenId,
      pins,
      activeId: get().activeId === pinId ? null : get().activeId,
    })
  },
  setActive: (id) => set({ activeId: id }),
}))
