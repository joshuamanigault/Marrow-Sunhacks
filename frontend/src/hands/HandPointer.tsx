import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Raycaster, Vector2, type Object3D } from 'three'
import { useViewer } from '../workspace/viewer'
import { useHands } from './store'

/** Hold the pointer on one bone this long to select it. */
export const DWELL_MS = 900

const ray = new Raycaster()
const ndc = new Vector2()

/**
 * Lives inside the Canvas. Casts a ray from the hand cursor into the scene,
 * marks the bone under it as hovered, and selects it after a short hold.
 */
export function HandPointer() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const since = useRef({ id: null as string | null, at: 0, done: false })

  useFrame(() => {
    const hands = useHands.getState()
    const track = since.current
    if (hands.status !== 'on' || hands.gesture !== 'point' || !hands.pointer) {
      if (hands.hoverId !== null || hands.dwell !== 0) useHands.setState({ hoverId: null, dwell: 0 })
      track.id = null
      return
    }

    ndc.set(hands.pointer.x * 2 - 1, -(hands.pointer.y * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const bones: Object3D[] = []
    scene.traverse((o) => {
      if (o.userData.structureId && o.visible && o.parent?.visible) bones.push(o)
    })
    const hit = ray.intersectObjects(bones, false)[0]
    const id = (hit?.object.userData.structureId as string | undefined) ?? null

    const now = performance.now()
    if (id !== track.id) {
      track.id = id
      track.at = now
      track.done = false
    }
    let dwell = 0
    if (id && !track.done) {
      dwell = Math.min(1, (now - track.at) / DWELL_MS)
      if (dwell >= 1) {
        track.done = true
        const viewer = useViewer.getState()
        // Match mouse: while Pin observation is armed, dwell places a draft pin.
        if (viewer.pinning && hit && id) {
          const p = hit.object.worldToLocal(hit.point.clone())
          viewer.setPick({ structureId: id, point: [p.x, p.y, p.z] })
        } else if (viewer.selectedId !== id) {
          viewer.select(id)
        }
      }
    } else if (id && track.done) {
      dwell = 1
    }
    if (hands.hoverId !== id || Math.abs(hands.dwell - dwell) > 0.02) useHands.setState({ hoverId: id, dwell })
  })
  return null
}
