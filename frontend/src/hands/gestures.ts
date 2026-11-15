// Turns MediaPipe's 21 hand landmarks into viewer gestures. Pure: no DOM, no three.
//
//   point (index finger only)  → cursor; hovering a bone highlights it, holding selects it
//   pinch (thumb + index)      → move the hand to rotate the skull
//   open hand / fist           → how open the hand is sets the explode amount
//
// Landmark x/y are 0..1 in the camera image. The preview is mirrored, so x is
// flipped here and moving your hand right moves things right on screen.

export interface Landmark {
  x: number
  y: number
  z: number
}

export type GestureKind = 'none' | 'point' | 'pinch' | 'open' | 'fist' | 'other'

export interface Point2 {
  x: number
  y: number
}

const WRIST = 0
const THUMB_TIP = 4
const INDEX_MCP = 5
const MIDDLE_MCP = 9
const FINGERS = [
  { tip: 8, pip: 6 }, // index
  { tip: 12, pip: 10 }, // middle
  { tip: 16, pip: 14 }, // ring
  { tip: 20, pip: 18 }, // pinky
] as const

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y)
const mirror = (p: Point2): Point2 => ({ x: 1 - p.x, y: p.y })

/** Thumb–index gap below this fraction of palm size counts as a pinch. */
export const PINCH_RATIO = 0.35
/** Average fingertip reach (in palm sizes) for a fist and for a fully open hand. */
export const OPENNESS_FIST = 1.25
export const OPENNESS_OPEN = 1.9

export interface HandReading {
  kind: GestureKind
  /** Index fingertip, mirrored, 0..1. */
  pointer: Point2
  /** Between thumb and index tips, mirrored, 0..1. */
  pinchPoint: Point2
  /** 0 = fist, 1 = fully open. */
  openness: number
}

export function readHand(lm: Landmark[]): HandReading | null {
  if (lm.length < 21) return null
  const wrist = lm[WRIST]
  const palm = dist(wrist, lm[MIDDLE_MCP]) || 1e-6
  // A finger is extended when its tip is clearly further from the wrist than its middle joint.
  const extended = FINGERS.map((f) => dist(lm[f.tip], wrist) > dist(lm[f.pip], wrist) * 1.1)
  const [index, middle, ring, pinky] = extended
  const count = extended.filter(Boolean).length
  const pinch = dist(lm[THUMB_TIP], lm[FINGERS[0].tip]) < palm * PINCH_RATIO

  const reach = FINGERS.reduce((sum, f) => sum + dist(lm[f.tip], wrist), 0) / FINGERS.length / palm
  const openness = Math.min(1, Math.max(0, (reach - OPENNESS_FIST) / (OPENNESS_OPEN - OPENNESS_FIST)))

  let kind: GestureKind = 'other'
  if (pinch && !(middle && ring && pinky)) kind = 'pinch'
  else if (index && !middle && !ring && !pinky) kind = 'point'
  else if (count >= 4) kind = 'open'
  else if (count === 0) kind = 'fist'

  const tip = lm[FINGERS[0].tip]
  const thumb = lm[THUMB_TIP]
  // Pinch point also uses the index knuckle so it doesn't jitter as the pinch closes.
  const knuckle = lm[INDEX_MCP]
  return {
    kind,
    pointer: mirror(tip),
    pinchPoint: mirror({ x: (tip.x + thumb.x + knuckle.x) / 3, y: (tip.y + thumb.y + knuckle.y) / 3 }),
    openness,
  }
}

export interface GestureFrame {
  /** Stable gesture (a new one must hold for a few frames before it counts). */
  kind: GestureKind
  /** Smoothed cursor while pointing, else null. */
  pointer: Point2 | null
  /** Rotation since the last frame while pinching, in screen fractions. */
  rotate: Point2 | null
  /** Smoothed explode amount 0..1 while the hand is open or a fist, else null. */
  separation: number | null
}

/** Frames a new gesture must persist before it replaces the current one. */
const STABLE_FRAMES = 3
const POINTER_SMOOTHING = 0.45
const SEPARATION_SMOOTHING = 0.25

/** Adds stability and smoothing on top of readHand, frame by frame. */
export class GestureInterpreter {
  private kind: GestureKind = 'none'
  private candidate: GestureKind = 'none'
  private candidateFrames = 0
  private pointer: Point2 | null = null
  private lastPinch: Point2 | null = null
  private separation: number | null = null

  update(landmarks: Landmark[] | null): GestureFrame {
    const reading = landmarks ? readHand(landmarks) : null
    const raw: GestureKind = reading ? reading.kind : 'none'

    if (raw === this.kind) {
      this.candidateFrames = 0
    } else if (raw === this.candidate) {
      if (++this.candidateFrames >= STABLE_FRAMES) {
        this.kind = raw
        this.candidateFrames = 0
        this.lastPinch = null // a fresh pinch must not jump the camera
      }
    } else {
      this.candidate = raw
      this.candidateFrames = 1
    }

    const frame: GestureFrame = { kind: this.kind, pointer: null, rotate: null, separation: null }
    if (!reading) {
      this.pointer = null
      this.lastPinch = null
      return frame
    }

    if (this.kind === 'point') {
      const p = reading.pointer
      this.pointer = this.pointer
        ? {
            x: this.pointer.x + (p.x - this.pointer.x) * POINTER_SMOOTHING,
            y: this.pointer.y + (p.y - this.pointer.y) * POINTER_SMOOTHING,
          }
        : p
      frame.pointer = this.pointer
    } else {
      this.pointer = null
    }

    if (this.kind === 'pinch' && raw === 'pinch') {
      const p = reading.pinchPoint
      if (this.lastPinch) frame.rotate = { x: p.x - this.lastPinch.x, y: p.y - this.lastPinch.y }
      this.lastPinch = p
    } else {
      this.lastPinch = null
    }

    if (this.kind === 'open' || this.kind === 'fist') {
      const target = reading.openness
      this.separation =
        this.separation === null ? target : this.separation + (target - this.separation) * SEPARATION_SMOOTHING
      frame.separation = this.separation
    } else {
      this.separation = null
    }
    return frame
  }
}
