import type { PinObservation } from '../types/pins'

/** Anonymous pin persistence for THIS browser only (localStorage). */

export function pinStorageKey(specimenId: string): string {
  return `marrow:pins:${specimenId}`
}

export function loadPins(specimenId: string): PinObservation[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(pinStorageKey(specimenId))
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PinObservation[]) : []
  } catch {
    return []
  }
}

export function savePins(specimenId: string, pins: PinObservation[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(pinStorageKey(specimenId), JSON.stringify(pins))
}

export function addPin(pin: PinObservation): PinObservation[] {
  const next = [...loadPins(pin.specimenId), pin]
  savePins(pin.specimenId, next)
  return next
}

export function removePin(specimenId: string, pinId: string): PinObservation[] {
  const next = loadPins(specimenId).filter((pin) => pin.id !== pinId)
  savePins(specimenId, next)
  return next
}
