import { CameraControls } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Sphere, Vector3, type Box3 } from 'three'
import type { Specimen } from '../workspace/specimen'
import { useViewer } from '../workspace/viewer'
import { explodeOffset, explodeOrigin, structureBox } from './layout'

// fitToSphere keeps the current viewing angle (fitToBox snaps to the nearest axis).
const fitTarget = (box: Box3) => box.getBoundingSphere(new Sphere())

interface CameraRigProps {
  specimen: Specimen
  box: Box3
  center: Vector3
}

/**
 * Frames the assembled specimen on open and remembers that as "home".
 * Answers the store's camera requests: focus a bone, rotate, reset.
 */
export function CameraRig({ specimen, box, center }: CameraRigProps) {
  const controls = useRef<CameraControls>(null)

  // Units are unknown (spec §5), so size clipping planes and zoom limits to the specimen.
  useEffect(() => {
    const c = controls.current
    if (!c || box.isEmpty()) return
    const radius = box.getSize(new Vector3()).length() / 2 || 1
    const camera = c.camera
    if (camera instanceof PerspectiveCamera) {
      camera.near = radius / 200
      camera.far = radius * 200
      camera.updateProjectionMatrix()
    }
    c.minDistance = radius * 0.05
    c.maxDistance = radius * 12
    // A three-quarter view reads as 3D; looking straight down an axis looks flat.
    void c.rotateTo(Math.PI / 5, Math.PI / 2.6, false)
    void c.fitToSphere(fitTarget(box), false).then(() => c.saveState())
  }, [box])

  useEffect(
    () =>
      useViewer.subscribe((state, prev) => {
        const req = state.camera
        const c = controls.current
        if (!req || req === prev.camera || !c) return
        if (req.kind === 'reset') {
          void c.reset(true)
        } else if (req.kind === 'rotate') {
          void c.rotate(req.radians, 0, true)
        } else {
          const s = specimen.structures.find((x) => x.id === req.id)
          const b = s && structureBox(s)
          if (!s) return
          // Missing structure bounds: fit the whole specimen so Focus still moves the camera.
          if (!b) {
            if (!box.isEmpty()) void c.fitToSphere(fitTarget(box), true)
            return
          }
          // Frame the bone where it will sit: a focused bone stays put, anything
          // else is framed at its exploded position.
          const origin = explodeOrigin(specimen, state.focusedId, center)
          b.translate(explodeOffset(s, origin, state.separation))
          // A little extra room so the bone isn't jammed against the edges.
          const sphere = fitTarget(b)
          sphere.radius *= 1.35
          void c.fitToSphere(sphere, true)
        }
      }),
    [specimen, center, box],
  )

  return <CameraControls ref={controls} makeDefault />
}
