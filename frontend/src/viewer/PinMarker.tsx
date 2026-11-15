import { Billboard, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import type { BoneSpacePoint } from '../types/pins'

/** Accent teal — matches workspace --accent / bone highlight. */
const SAVED = '#1f5673'
/** Amber for the live pick before Save pin. */
const DRAFT = '#c47a1a'
/** Pins must not steal bone clicks / drag-orbit. */
const noRaycast = () => {}

interface PinMarkerProps {
  point: BoneSpacePoint
  /** World-ish size of the pin head (derived from the bone's bounds). */
  size: number
  draft?: boolean
  /** Structure name shown above the note. */
  label?: string
  /** Observation text — the reason the pin exists in 3D. */
  note?: string
  /** Expanded callout (clicked). */
  active?: boolean
  onSelect?: () => void
  /** Draft only: persist the typed note. */
  onSave?: (note: string) => void
  /** Draft only: abandon this placement. */
  onCancel?: () => void
  /** Saved pin: remove from this browser. */
  onRemove?: () => void
}

/**
 * Map-pin + note callout in bone-local space. Draft mode is the editor;
 * saved mode shows the note on the fossil. Parent under the bone's explode
 * group so both ride with separation / reassemble.
 */
export function PinMarker({
  point,
  size,
  draft = false,
  label,
  note,
  active = false,
  onSelect,
  onSave,
  onCancel,
  onRemove,
}: PinMarkerProps) {
  const tip = size * 0.22
  const stem = size * 0.55
  const head = size * 0.38
  const color = draft ? DRAFT : SAVED
  const calloutY = tip + stem + head * 2.4
  const showCallout = draft || Boolean(note)
  const interactive = Boolean(onSelect || draft)

  function handleMeshClick(e: ThreeEvent<MouseEvent>) {
    if (!onSelect) return
    e.stopPropagation()
    onSelect()
  }

  return (
    <Billboard position={point} follow>
      <mesh position={[0, tip * 0.5, 0]} raycast={noRaycast}>
        <sphereGeometry args={[tip, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={draft ? 0.55 : 0.35}
          roughness={0.45}
          metalness={0.05}
          depthTest
        />
      </mesh>
      <mesh position={[0, tip + stem * 0.5, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[tip * 0.35, tip * 0.55, stem, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh
        position={[0, tip + stem + head * 0.55, 0]}
        raycast={onSelect ? undefined : noRaycast}
        onClick={onSelect ? handleMeshClick : undefined}
      >
        <sphereGeometry args={[head, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={draft ? 0.4 : 0.25}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {showCallout && (
        <Html
          position={[0, calloutY, 0]}
          center
          style={{ pointerEvents: interactive || draft ? 'auto' : 'none' }}
          zIndexRange={[140, 40]}
        >
          {draft ? (
            <DraftCallout label={label} onSave={onSave} onCancel={onCancel} />
          ) : (
            <SavedCallout
              label={label}
              note={note!}
              active={active}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          )}
        </Html>
      )}
    </Billboard>
  )
}

function stopCanvasGesture(e: SyntheticEvent) {
  e.stopPropagation()
}

function DraftCallout({
  label,
  onSave,
  onCancel,
}: {
  label?: string
  onSave?: (note: string) => void
  onCancel?: () => void
}) {
  const [text, setText] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const canSave = text.trim().length > 0

  useEffect(() => {
    // Let the Html portal mount, then focus so the visitor can type immediately.
    const id = window.setTimeout(() => areaRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [])

  function handleSave() {
    const note = text.trim()
    if (!note || !onSave) return
    onSave(note)
  }

  return (
    <form
      className="pin-callout is-draft is-active is-editor"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      onPointerDown={stopCanvasGesture}
      onWheel={stopCanvasGesture}
    >
      {label && (
        <label className="pin-callout-bone" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        ref={areaRef}
        className="pin-callout-input"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you notice on this bone?"
        aria-label="Observation note"
      />
      <div className="pin-callout-actions">
        <button type="button" className="pin-callout-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pin-callout-save" disabled={!canSave}>
          Save
        </button>
      </div>
    </form>
  )
}

function SavedCallout({
  label,
  note,
  active,
  onSelect,
  onRemove,
}: {
  label?: string
  note: string
  active: boolean
  onSelect?: () => void
  onRemove?: () => void
}) {
  return (
    <div
      className={['pin-callout', active ? 'is-active' : ''].filter(Boolean).join(' ')}
      onPointerDown={stopCanvasGesture}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onKeyDown={(e) => {
        if (!onSelect) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {label && <span className="pin-callout-bone">{label}</span>}
      <span className="pin-callout-note">{note}</span>
      {active && onRemove && (
        <button
          type="button"
          className="pin-callout-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          Remove
        </button>
      )}
    </div>
  )
}
