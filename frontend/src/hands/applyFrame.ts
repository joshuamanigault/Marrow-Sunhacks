import { useViewer } from '../workspace/viewer'
import type { GestureInterpreter } from './gestures'
import { addRotation, useHands } from './store'

/** Full-width pinch drag turns the skull this much (radians). */
const ROTATE_GAIN = Math.PI * 1.6
/** Ignore explode changes smaller than this, so the store isn't flooded. */
const SEPARATION_STEP = 0.02

/** Applies one frame of gestures to the viewer. */
export function applyFrame(interp: GestureInterpreter, landmarks: Parameters<GestureInterpreter['update']>[0]) {
  const frame = interp.update(landmarks)
  useHands.setState({ gesture: frame.kind, pointer: frame.pointer })

  if (frame.rotate) addRotation(-frame.rotate.x * ROTATE_GAIN, -frame.rotate.y * ROTATE_GAIN)

  if (frame.separation !== null) {
    const v = useViewer.getState()
    if (v.mode !== 'exploded') {
      // Only an open hand starts exploding; a fist while assembled does nothing.
      if (frame.kind === 'open' && frame.separation > 0.1) {
        v.setMode('exploded')
        useViewer.getState().setSeparation(frame.separation)
      }
    } else if (Math.abs(v.separation - frame.separation) > SEPARATION_STEP) {
      v.setSeparation(frame.separation)
    }
  }
}

