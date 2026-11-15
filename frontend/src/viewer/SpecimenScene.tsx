import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import { Color, Vector3, type DirectionalLight } from 'three'
import { NATURAL_BONE, structureLabel, type Specimen, type Structure } from '../workspace/specimen'
import { Bone } from './Bone'
import { CameraRig } from './CameraRig'
import { boneColor, explodeOrigin, specimenBox } from './layout'
import { useViewer } from '../workspace/viewer'
import { HandControl } from '../hands/HandControl'
import { HandPointer } from '../hands/HandPointer'

const UP = new Vector3()
const RIGHT = new Vector3()

/**
 * A key light that rides with the camera (the specimen's axis convention is
 * unknown, so no fixed "sun" direction works), set up and to the right so
 * faces still shade differently.
 */
function KeyLight({ center, radius }: { center: Vector3; radius: number }) {
  const light = useRef<DirectionalLight>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const l = light.current
    if (!l) return
    UP.set(0, 1, 0).applyQuaternion(camera.quaternion)
    RIGHT.set(1, 0, 0).applyQuaternion(camera.quaternion)
    l.position.copy(camera.position).addScaledVector(UP, radius).addScaledVector(RIGHT, radius * 0.6)
    l.target.position.copy(center)
    l.target.updateMatrixWorld()
  })
  return <directionalLight ref={light} intensity={1.8} />
}

/**
 * One bad mesh must not take down the scene. The structure list still names it;
 * this only keeps the other bones on screen.
 */
class MeshBoundary extends Component<{ structure: Structure; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn(`Could not load mesh for ${structureLabel(this.props.structure)}`, error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function SpecimenScene({ specimen }: { specimen: Specimen }) {
  // Bounds come with the payload, so framing and explode need no mesh downloads.
  const box = useMemo(() => specimenBox(specimen), [specimen])
  const center = useMemo(() => box.getCenter(new Vector3()), [box])
  const radius = useMemo(() => box.getSize(new Vector3()).length() / 2 || 1, [box])
  const focusedId = useViewer((s) => s.focusedId)
  const origin = useMemo(() => explodeOrigin(specimen, focusedId, center), [specimen, focusedId, center])

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 35 }}
        aria-label="3D specimen. Drag to rotate, scroll to zoom, click a bone to select it."
      >
        <hemisphereLight args={['#ffffff', '#8a7a62', 0.9]} />
        <KeyLight center={center} radius={radius} />
        {specimen.structures.map((s) =>
          s.status === 'ok' && s.meshUrl ? (
            <MeshBoundary key={s.id} structure={s}>
              <Suspense fallback={null}>
                <Bone
                  structure={s}
                  color={boneColor(s) ?? new Color(NATURAL_BONE)}
                  explodeOrigin={origin}
                />
              </Suspense>
            </MeshBoundary>
          ) : null,
        )}
        <CameraRig specimen={specimen} box={box} center={center} />
        <HandPointer />
      </Canvas>
      <HandControl specimen={specimen} />
    </>
  )
}
