import { useEffect, useRef } from 'react'
import { structureLabel, type Specimen } from '../workspace/specimen'
import { applyFrame } from './applyFrame'
import { GestureInterpreter, type GestureKind } from './gestures'
import { useHands } from './store'
import { startHandTracking } from './tracker'
import './hands.css'

const HINTS: Record<GestureKind, string> = {
  none: 'Show one hand to the camera',
  point: '☝️ Pointing: hold on a bone to select it',
  pinch: '🤏 Pinch: move to rotate',
  open: '🖐 Open hand: exploding',
  fist: '✊ Fist: reassembling',
  other: 'Try point, pinch, open hand or fist',
}

/**
 * Camera toggle, mirrored preview, gesture hint and the on-screen cursor.
 * Sits over the 3D scene; the scene itself reads hover state from useHands.
 */
export function HandControl({ specimen }: { specimen: Specimen }) {
  const video = useRef<HTMLVideoElement>(null)
  const stop = useRef<(() => void) | null>(null)
  const { status, error, gesture, pointer, hoverId, dwell } = useHands()

  async function turnOn() {
    if (!video.current || stop.current) return
    useHands.setState({ status: 'loading', error: null })
    const interp = new GestureInterpreter()
    try {
      stop.current = await startHandTracking(video.current, (lm) => applyFrame(interp, lm))
      useHands.setState({ status: 'on' })
    } catch (e) {
      useHands.setState({ status: 'error', error: (e as Error).message })
    }
  }
  function turnOff() {
    stop.current?.()
    stop.current = null
    useHands.setState({ status: 'off', gesture: 'none', pointer: null, hoverId: null, dwell: 0 })
  }
  useEffect(() => turnOff, [])

  const active = status === 'on' || status === 'loading'
  const hovered = hoverId ? specimen.structures.find((s) => s.id === hoverId) : undefined

  return (
    <div className="hc" data-active={active || undefined}>
      <button
        type="button"
        className="hc-toggle"
        aria-pressed={active}
        title={active ? 'Turn hand control off' : 'Control the skull with your hand (uses your camera)'}
        onClick={() => (active ? turnOff() : void turnOn())}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 11.5V6.5a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6 7-2.6 0-4-1.3-5.4-3.4L3.8 15a1.5 1.5 0 0 1 2.4-1.8L8 15" />
        </svg>
        {status === 'loading' ? 'Starting…' : active ? 'Hand control on' : 'Hand control'}
      </button>

      <div className="hc-panel" hidden={!active && status !== 'error'}>
        <video ref={video} className="hc-video" playsInline muted aria-label="Your camera, mirrored" />
        {status === 'on' && (
          <p className="hc-hint" role="status">
            {HINTS[gesture]}
            {hovered && gesture === 'point' ? ` · ${structureLabel(hovered)}` : ''}
          </p>
        )}
        {status === 'loading' && <p className="hc-hint">Starting camera and loading the hand model…</p>}
        {status === 'error' && (
          <p className="hc-error" role="alert">
            {error}
          </p>
        )}
        {status === 'on' && (
          <ul className="hc-help">
            <li>☝️ point · hold to select</li>
            <li>🤏 pinch + move · rotate</li>
            <li>🖐 open · explode, ✊ fist · reassemble</li>
          </ul>
        )}
      </div>

      {status === 'on' && pointer && (
        <div
          className="hc-cursor"
          data-hover={hoverId ? true : undefined}
          style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%`, ['--dwell' as string]: dwell }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
