import { useEffect, useState } from 'react'
import { addPin, loadPins, removePin } from '../pins/storage'
import { STATUS_COPY } from '../statusCopy'
import type { PinObservation } from '../types/pins'
import {
  structureLabel,
  type Specimen,
  type Structure,
} from '../workspace/specimen'
import { useViewer } from '../workspace/viewer'
import { StatusBanner } from './StatusBanner'

/**
 * Notes panel + pin MVP (Alexandra tasks 4 & 6).
 * Uses Alex’s shell slot and Ananya’s useViewer().pick / selectedId.
 */
export function ObservationsPanel({ specimen }: { specimen: Specimen }) {
  const selectedId = useViewer((s) => s.selectedId)
  const pick = useViewer((s) => s.pick)
  const select = useViewer((s) => s.select)
  const setPick = useViewer((s) => s.setPick)

  const [pins, setPins] = useState<PinObservation[]>([])
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setPins(loadPins(specimen.id))
    setNote('')
    setMessage(null)
  }, [specimen.id])

  const selected = specimen.structures.find((s) => s.id === selectedId)
  const readyStructures = specimen.structures.filter((s) => s.status === 'ok')

  const canSave =
    Boolean(pick?.structureId) &&
    Array.isArray(pick?.point) &&
    note.trim().length > 0

  function handleSave() {
    if (!pick?.structureId || !pick.point || !note.trim()) {
      setMessage(STATUS_COPY.needPick)
      return
    }
    const structure = specimen.structures.find((s) => s.id === pick.structureId)
    const pin: PinObservation = {
      id: crypto.randomUUID(),
      specimenId: specimen.id,
      structureId: pick.structureId,
      structureLabel: structure ? structureLabel(structure) : pick.structureId,
      boneSpacePoint: [pick.point[0], pick.point[1], pick.point[2]],
      note: note.trim(),
      createdAt: new Date().toISOString(),
    }
    setPins(addPin(pin))
    setNote('')
    setPick(null)
    setMessage(
      'Pin saved in this browser only. It stays on the bone through explode → reassemble → reset because the point is stored in bone space.',
    )
  }

  function handleDemoPick(structure: Structure) {
    select(structure.id)
    // Demo bone-space point until Ananya’s raycast sets pick from the mesh.
    setPick({ structureId: structure.id, point: [0.12, 0.04, -0.03] })
    setMessage(
      `Demo pick on ${structureLabel(structure)}. Replace with the 3D picker when ready.`,
    )
  }

  return (
    <section aria-labelledby="ws-notes-title">
      <h2 id="ws-notes-title">Observations</h2>

      <p className="pin-form-meta">
        Selected:{' '}
        <strong>
          {selected ? structureLabel(selected) : selectedId ?? 'None yet'}
        </strong>
        {pick?.point ? (
          <>
            {' '}
            · bone-space{' '}
            <code>
              ({pick.point[0].toFixed(3)}, {pick.point[1].toFixed(3)},{' '}
              {pick.point[2].toFixed(3)})
            </code>
          </>
        ) : (
          <> · no pick point yet</>
        )}
      </p>

      {readyStructures.length > 0 && (
        <div className="pin-demo-row">
          <span className="pin-form-meta">Demo pick:</span>
          {readyStructures.slice(0, 6).map((s) => (
            <button
              key={s.id}
              type="button"
              className="pin-demo-btn"
              onClick={() => handleDemoPick(s)}
            >
              {structureLabel(s)}
            </button>
          ))}
        </div>
      )}

      <label className="pin-form-label" htmlFor="pin-note">
        Your note (anonymous, this browser only)
      </label>
      <textarea
        id="pin-note"
        className="pin-form-input"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did you notice on this bone?"
      />
      <button
        type="button"
        className="pin-form-save"
        disabled={!canSave}
        onClick={handleSave}
      >
        Save pin
      </button>
      {message && <p className="pin-form-meta">{message}</p>}

      <h3 className="pin-form-label">Saved pins</h3>
      {pins.length === 0 ? (
        <StatusBanner kind="empty" title={STATUS_COPY.noPinsTitle}>
          {STATUS_COPY.noPinsBody}
        </StatusBanner>
      ) : (
        <ul className="pin-list">
          {pins.map((pin) => (
            <li key={pin.id} className="pin-item">
              <p className="pin-item-bone">{pin.structureLabel}</p>
              <p className="pin-item-note">{pin.note}</p>
              <p className="pin-item-point">
                bone-space{' '}
                <code>
                  ({pin.boneSpacePoint[0].toFixed(3)},{' '}
                  {pin.boneSpacePoint[1].toFixed(3)},{' '}
                  {pin.boneSpacePoint[2].toFixed(3)})
                </code>
              </p>
              <button
                type="button"
                className="pin-item-delete"
                onClick={() => setPins(removePin(specimen.id, pin.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
