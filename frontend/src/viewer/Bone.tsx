import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Mesh, type BufferGeometry, type Color, type Vector3 } from 'three'
import { apiUrl, type Structure } from '../workspace/specimen'
import { useViewer } from '../workspace/viewer'
import { explodeOffset } from './layout'

/** Natural bone tone when "Color by structure" is off. */
const BONE = '#d9cba9'
const HIGHLIGHT = '#1f5673'
/** Pointer travel (px) above which a press counts as a drag, not a click. */
const CLICK_SLOP = 4
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
  specimenCenter: Vector3
}

export function Bone({ structure, color, specimenCenter }: BoneProps) {
  const id = structure.id
  const geometry = useBoneGeometry(apiUrl(structure.meshUrl!))

  const hidden = useViewer((s) => !!s.hiddenIds[id])
  const selected = useViewer((s) => s.selectedId === id)
  const xray = useViewer((s) => s.mode === 'xray')
  const separation = useViewer((s) => s.separation)
  const colorByStructure = useViewer((s) => s.colorByStructure)
  const setPick = useViewer((s) => s.setPick)

  const offset = useMemo(
    () => explodeOffset(structure, specimenCenter, separation),
    [structure, specimenCenter, separation],
  )

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
    <group position={offset} visible={!hidden}>
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
          emissive={selected ? HIGHLIGHT : '#000000'}
          emissiveIntensity={selected ? 0.35 : 0}
          // X-ray is a rendering style, not a radiograph (spec §2).
          transparent
          opacity={xray ? (selected ? 0.9 : 0.22) : 1}
          depthWrite={!xray || selected}
        />
      </mesh>
    </group>
  )
}
