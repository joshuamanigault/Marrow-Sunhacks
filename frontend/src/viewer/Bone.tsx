import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, type BufferGeometry, type Color, type Group, type Vector3 } from 'three'
import { apiUrl, NATURAL_BONE, type Structure } from '../workspace/specimen'
import { useViewer } from '../workspace/viewer'
import { useHands } from '../hands/store'
import { explodeOffset } from './layout'

/** Natural bone tone when "Color by structure" is off or structure.color is null. */
const BONE = NATURAL_BONE
const HIGHLIGHT = '#1f5673'
/** Glow for the bone under the hand-control cursor. */
const HAND_HOVER = '#f2a623'
/** Pointer travel (px) above which a press counts as a drag, not a click. */
const CLICK_SLOP = 4
/** How fast bones glide to their explode position (higher = snappier). */
const GLIDE = 8
/** Opacity of bones that are faded back (X-ray, or not the focused bone). */
const FADED = 0.18
/** Hidden bones must not catch clicks (three's raycaster ignores `visible`). */
const noRaycast = () => {}

/** The one mesh in a structure's GLB, with any node transform baked in. */
function useBoneGeometry(url: string): BufferGeometry {
  const { scene } = useGLTF(url)
  const geometry = useMemo(() => {
    scene.updateMatrixWorld(true)
    let found: Mesh | undefined
    scene.traverse((o) => {
      if (!found && o instanceof Mesh) found = o
    })
    if (!found) throw new Error(`No mesh in ${url}`)
    const g = found.geometry.clone().applyMatrix4(found.matrixWorld)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    return g
  }, [scene, url])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

interface BoneProps {
  structure: Structure
  color: Color
  /** Where Exploded pushes from (specimen center, or the focused bone's center). */
  explodeOrigin: Vector3
}

export function Bone({ structure, color, explodeOrigin }: BoneProps) {
  const id = structure.id
  const geometry = useBoneGeometry(apiUrl(structure.meshUrl!))

  const hidden = useViewer((s) => !!s.hiddenIds[id])
  const selected = useViewer((s) => s.selectedId === id)
  const xray = useViewer((s) => s.mode === 'xray')
  const focusing = useViewer((s) => s.focusedId !== null)
  const focused = useViewer((s) => s.focusedId === id)
  const separation = useViewer((s) => s.separation)
  const colorByStructure = useViewer((s) => s.colorByStructure)
  const setPick = useViewer((s) => s.setPick)
  const handHover = useHands((s) => s.hoverId === id)

  const target = useMemo(
    () => explodeOffset(structure, explodeOrigin, separation),
    [structure, explodeOrigin, separation],
  )
  // Glide to the target instead of jumping, so exploding reads as motion.
  const group = useRef<Group>(null)
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    if (g.position.distanceToSquared(target) < 1e-8) g.position.copy(target)
    else g.position.lerp(target, 1 - Math.exp(-dt * GLIDE))
  })

  // Faded = see-through: everything but the selection in X-ray, and everything
  // but the focused bone while one is focused.
  const faded = focusing ? !focused : xray && !selected

  // Pointer cursor is set on hover; clear it if we unmount or hide while hovered
  // (onPointerOut may never fire in those cases).
  useEffect(() => {
    if (hidden) document.body.style.cursor = ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hidden])

  function onClick(e: ThreeEvent<MouseEvent>) {
    // Only the nearest bone under the pointer, and never at the end of a drag.
    e.stopPropagation()
    if (e.delta > CLICK_SLOP) return
    // Mesh-local space = specimen space here, so the pick ignores camera and explode.
    const p = e.object.worldToLocal(e.point.clone())
    setPick({ structureId: id, point: [p.x, p.y, p.z] })
  }

  return (
    // The group carries the explode offset; the mesh itself stays at identity.
    <group ref={group} visible={!hidden}>
      <mesh
        name={id}
        geometry={geometry}
        userData={{ structureId: id }}
        raycast={hidden ? noRaycast : Mesh.prototype.raycast}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      >
        <meshStandardMaterial
          color={colorByStructure ? color : BONE}
          roughness={0.8}
          metalness={0}
          emissive={handHover ? HAND_HOVER : selected ? HIGHLIGHT : '#000000'}
          emissiveIntensity={handHover ? 0.45 : selected ? 0.35 : 0}
          // X-ray is a rendering style, not a radiograph (spec §2).
          transparent
          opacity={faded ? FADED : xray && !focusing ? 0.9 : 1}
          depthWrite={!faded}
        />
      </mesh>
    </group>
  )
}
