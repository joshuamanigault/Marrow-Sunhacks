// Webcam + MediaPipe HandLandmarker. Runs entirely in the browser: no video
// leaves the machine. Loaded lazily so the viewer doesn't pay for it until used.

import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { Landmark } from './gestures'

/** Google's published hand model (~8 MB, cached by the browser after the first load). */
export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Give up loading the model after this long. */
const LOAD_TIMEOUT_MS = 20_000

export type FrameHandler = (landmarks: Landmark[] | null) => void

/** Starts the camera and hand tracking; resolves to a stop function. */
export async function startHandTracking(video: HTMLVideoElement, onFrame: FrameHandler): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access.')

  const stream = await navigator.mediaDevices
    .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
    .catch((e: Error) => {
      throw new Error(
        e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow it in the browser and try again.'
          : 'No camera found.',
      )
    })
  const stopStream = () => stream.getTracks().forEach((t) => t.stop())

  try {
    video.srcObject = stream
    await video.play()

    const { HandLandmarker } = await import('@mediapipe/tasks-vision')
    const fileset = { wasmLoaderPath, wasmBinaryPath }
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    })
    // GPU is much faster; fall back to CPU where WebGL isn't available to it.
    const load = HandLandmarker.createFromOptions(fileset, options('GPU')).catch(() =>
      HandLandmarker.createFromOptions(fileset, options('CPU')),
    )
    // Don't leave the visitor on "Starting…" forever on a bad connection.
    const landmarker = await Promise.race([
      load,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS)),
    ])

    let frame = 0
    let lastTime = -1
    let running = true
    const loop = () => {
      if (!running) return
      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime
        const result = landmarker.detectForVideo(video, performance.now())
        onFrame(result.landmarks[0] ?? null)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      landmarker.close()
      stopStream()
      video.srcObject = null
    }
  } catch (e) {
    stopStream()
    console.warn('Hand tracking failed to start', e)
    const timedOut = e instanceof Error && e.message === 'timeout'
    throw new Error(
      timedOut
        ? 'Hand tracking took too long to load. Check your connection and try again.'
        : 'Could not load hand tracking. Check your internet connection (the hand model downloads once).',
    )
  }
}
