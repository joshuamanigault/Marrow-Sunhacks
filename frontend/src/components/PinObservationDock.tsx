import { useEffect, useState } from "react"
import { addPin, loadPins, removePin } from "../pins/storage"
import { STATUS_COPY } from "../statusCopy"
import { useViewerStore } from "../store/viewerStore"
import type { PinObservation } from "../types/pins"
import { StatusBanner } from "./StatusBanner"

/**
 * Bottom dock: Pin observation MVP (Alexandra task 4 / spec §2 + §3.1).
 *
 * - Uses Ananya’s selectedStructureId + boneSpacePick from Zustand
 * - Saves notes anonymously in localStorage for THIS browser only
 * - Restores pins when the same specimenId is opened again
 * - Stores bone-space XYZ so explode/reassemble/reset keep the pin on anatomy
 *
 * Three.js marker rendering is Ananya’s job; this dock owns the note UI.
 */
type PinObservationDockProps = {
  /** Active specimen id (must match localStorage key) */
  specimenId: string
  /**
   * Optional demo helper: list of selectable ok structure ids/labels
   * so you can test pins before the Three.js picker exists.
   */
  demoStructures?: { id: string; label: string }[]
}

export function PinObservationDock({
  specimenId,
  demoStructures = [],
}: PinObservationDockProps) {
  // Values Ananya’s scene will write into the store
  const selectedStructureId = useViewerStore((s) => s.selectedStructureId)
  const selectedStructureLabel = useViewerStore((s) => s.selectedStructureLabel)
  const boneSpacePick = useViewerStore((s) => s.boneSpacePick)
  const setSelectedStructure = useViewerStore((s) => s.setSelectedStructure)
  const setBoneSpacePick = useViewerStore((s) => s.setBoneSpacePick)
  const clearBoneSpacePick = useViewerStore((s) => s.clearBoneSpacePick)

  // Pins currently shown for this specimen
  const [pins, setPins] = useState<PinObservation[]>([])
  // Text the visitor is typing
  const [note, setNote] = useState("")
  // Small status line under the form
  const [message, setMessage] = useState<string | null>(null)

  // Restore pins whenever specimenId changes (reopen same study)
  useEffect(() => {
    // Read anonymous notes for this specimen from localStorage
    setPins(loadPins(specimenId))
    // Clear the draft note when switching studies
    setNote("")
    setMessage(null)
  }, [specimenId])

  // Can we save? Need a bone, a bone-space point, and some text
  const canSave =
    Boolean(selectedStructureId) &&
    boneSpacePick !== null &&
    note.trim().length > 0

  function handleSave() {
    // Extra guard (button should already be disabled)
    if (!selectedStructureId || !boneSpacePick || !note.trim()) {
      setMessage("Select a bone, pick a point, and write a short note first.")
      return
    }

    // Build one pin object — bone-space point is the anatomy anchor
    const pin: PinObservation = {
      id: crypto.randomUUID(), // unique id in this browser
      specimenId, // ties pin to this fossil study
      structureId: selectedStructureId, // which bone
      structureLabel: selectedStructureLabel ?? selectedStructureId,
      boneSpacePoint: {
        // Copy numbers so later edits cannot mutate the store by accident
        x: boneSpacePick.x,
        y: boneSpacePick.y,
        z: boneSpacePick.z,
      },
      note: note.trim(),
      createdAt: new Date().toISOString(),
    }

    // Persist + update the on-screen list
    const next = addPin(pin)
    setPins(next)

    // Reset draft UI; keep bone selected for another note if wanted
    setNote("")
    clearBoneSpacePick()
    setMessage(
      "Pin saved in this browser only. It stays on the bone through explode → reassemble → reset because the point is stored in bone space.",
    )
  }

  function handleDelete(pinId: string) {
    // Remove from localStorage and refresh the list
    setPins(removePin(specimenId, pinId))
    setMessage("Pin removed from this browser.")
  }

  /**
   * Demo-only: pretend Ananya picked a bone + bone-space point.
   * Remove or hide when real Three.js picking is wired.
   */
  function handleDemoPick(structureId: string, label: string) {
    // Select the bone in the shared store
    setSelectedStructure(structureId, label)
    // Fake a stable bone-local point (not screen pixels)
    setBoneSpacePick({ x: 0.12, y: 0.04, z: -0.03 })
    setMessage(
      `Demo pick set on ${label}. Replace this with Ananya’s real raycast pick.`,
    )
  }

  return (
    // Bottom dock stays available without leaving the canvas (spec §3.1)
    <section className="pin-dock" aria-label="Pin observation">
      <div className="pin-dock-main">
        <h2 className="pin-dock-heading">Pin observation</h2>

        {/* Show what Ananya currently has selected */}
        <p className="pin-dock-meta">
          Selected bone:{" "}
          <strong>
            {selectedStructureLabel ?? selectedStructureId ?? "None yet"}
          </strong>
          {boneSpacePick ? (
            <>
              {" "}
              · bone-space point:{" "}
              <code>
                ({boneSpacePick.x.toFixed(3)}, {boneSpacePick.y.toFixed(3)},{" "}
                {boneSpacePick.z.toFixed(3)})
              </code>
            </>
          ) : (
            <> · no pick point yet</>
          )}
        </p>

        {/* Demo controls until Three.js selection exists */}
        {demoStructures.length > 0 && (
          <div className="pin-dock-demo">
            <span className="pin-dock-demo-label">Demo pick (until Three.js):</span>
            {demoStructures.map((row) => (
              <button
                key={row.id}
                type="button"
                className="pin-dock-demo-btn"
                onClick={() => handleDemoPick(row.id, row.label)}
              >
                {row.label}
              </button>
            ))}
          </div>
        )}

        {/* Note field */}
        <label className="pin-dock-label" htmlFor="pin-note">
          Your note (anonymous, this browser only)
        </label>
        <textarea
          id="pin-note"
          className="pin-dock-input"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you notice on this bone?"
        />

        {/* Save uses bone id + bone-space point from the store */}
        <button
          type="button"
          className="pin-dock-save"
          disabled={!canSave}
          onClick={handleSave}
        >
          Save pin
        </button>

        {message && <p className="pin-dock-message">{message}</p>}
      </div>

      {/* Restored / saved pins for this specimen */}
      <div className="pin-dock-list-wrap">
        <h3 className="pin-dock-subheading">Saved pins</h3>

        {pins.length === 0 ? (
          // Task 6: plain-language empty state (not an error)
          <StatusBanner kind="empty" title={STATUS_COPY.noPinsTitle}>
            {STATUS_COPY.noPinsBody}
          </StatusBanner>
        ) : (
          <ul className="pin-dock-list">
            {pins.map((pin) => (
              <li key={pin.id} className="pin-dock-item">
                <p className="pin-dock-item-bone">{pin.structureLabel}</p>
                <p className="pin-dock-item-note">{pin.note}</p>
                <p className="pin-dock-item-point">
                  bone-space{" "}
                  <code>
                    ({pin.boneSpacePoint.x.toFixed(3)},{" "}
                    {pin.boneSpacePoint.y.toFixed(3)},{" "}
                    {pin.boneSpacePoint.z.toFixed(3)})
                  </code>
                </p>
                <button
                  type="button"
                  className="pin-dock-delete"
                  onClick={() => handleDelete(pin.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
