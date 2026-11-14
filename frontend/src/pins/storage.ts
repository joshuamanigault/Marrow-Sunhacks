import type { PinObservation } from "../types/pins"

/**
 * Anonymous pin persistence for THIS browser only (localStorage).
 * Spec §2: not a shared room, no accounts, restore on reopen of same specimen.
 */

/** Builds a storage key unique to one specimen id */
export function pinStorageKey(specimenId: string): string {
  // Prefix keeps Marrow keys easy to find in DevTools → Application → Local Storage
  return `marrow:pins:${specimenId}`
}

/** Read all pins saved for this specimen (or [] if none / corrupted) */
export function loadPins(specimenId: string): PinObservation[] {
  // SSR / non-browser safety
  if (typeof localStorage === "undefined") {
    return []
  }

  // Look up the JSON string for this specimen
  const raw = localStorage.getItem(pinStorageKey(specimenId))

  // First visit → no pins yet
  if (!raw) {
    return []
  }

  try {
    // Parse the saved array
    const parsed: unknown = JSON.parse(raw)

    // Only accept a real array; otherwise treat as empty
    if (!Array.isArray(parsed)) {
      return []
    }

    // Trust shape lightly for MVP; Joshua/Ananya ids are strings
    return parsed as PinObservation[]
  } catch {
    // Bad JSON should not crash the workspace
    return []
  }
}

/** Overwrite the saved pin list for one specimen */
export function savePins(specimenId: string, pins: PinObservation[]): void {
  if (typeof localStorage === "undefined") {
    return
  }

  // Stringify the whole list and store under the specimen key
  localStorage.setItem(pinStorageKey(specimenId), JSON.stringify(pins))
}

/** Append one pin and persist immediately */
export function addPin(pin: PinObservation): PinObservation[] {
  // Load existing notes for this specimen
  const existing = loadPins(pin.specimenId)
  // Add the new pin at the end
  const next = [...existing, pin]
  // Write back to localStorage
  savePins(pin.specimenId, next)
  // Return the new list so React can update UI
  return next
}

/** Remove one pin by id for a specimen */
export function removePin(
  specimenId: string,
  pinId: string,
): PinObservation[] {
  const existing = loadPins(specimenId)
  const next = existing.filter((pin) => pin.id !== pinId)
  savePins(specimenId, next)
  return next
}
