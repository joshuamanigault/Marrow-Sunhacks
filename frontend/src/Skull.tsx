import { Html, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import * as THREE from 'three'

// The real skull of YPM VP 41198: the 21 bones from the study's Appendix 2
// (Dryad, CC0), one node per structure id. public/skull.glb is a lightweight
// copy for this page only, built from Joshua's prepared meshes with
// glTF-Transform 4.5.1:
//   merge data/prepared/ypm-vp-41198/meshes/*.glb merged.glb --merge-scenes
//   weld merged.glb welded.glb
//   simplify welded.glb s.glb --ratio 0.15 --error 0.01
//   meshopt s.glb skull.glb --level high
// The workspace loads the full-detail meshes from the API instead.
const SKULL_URL = `${import.meta.env.BASE_URL}skull.glb`

/** Roof-of-mouth bones, hidden while the skull is assembled. */
const PALATE = new Set([
  'pterygoid_l',
  'pterygoid_r',
  'palatine_r',
  'vomers',
  'ectopterygoid_l',
  'ectopterygoid_r',
])

type Bone = {
  /** Structure id, e.g. maxilla_r. */
  name: string
  geometry: THREE.BufferGeometry
  /** Bone centre in skull space; the geometry is re-centred on it. */
  home: THREE.Vector3
  dir: THREE.Vector3
  distance: number
  spin: THREE.Vector3
  material: THREE.Material
}

function setCursor(el: HTMLElement, cursor: string) {
  el.style.cursor = cursor
}

/** Deterministic 0..1 noise so the burst looks the same on every load. */
function rand(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function smoothstep(t: number) {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

function useBones() {
  const { scene } = useGLTF(SKULL_URL)
  return useMemo(() => {
    scene.updateMatrixWorld(true)
    const sources: THREE.Mesh[] = []
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) sources.push(o as THREE.Mesh)
    })

    const box = new THREE.Box3().setFromObject(scene)
    const centre = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length()

    const bones: Bone[] = sources.map((mesh, i) => {
      // meshopt stores positions as quantized integers; expand them to floats
      // before transforming, or applyMatrix4 clamps them.
      const geometry = new THREE.BufferGeometry()
      const pos = mesh.geometry.getAttribute('position')
      const floats = new Float32Array(pos.count * 3)
      for (let v = 0; v < pos.count; v++) {
        floats.set([pos.getX(v), pos.getY(v), pos.getZ(v)], v * 3)
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(floats, 3))
      geometry.setIndex(mesh.geometry.getIndex())
      geometry.applyMatrix4(mesh.matrixWorld)
      geometry.computeBoundingBox()
      const home = geometry.boundingBox!.getCenter(new THREE.Vector3())
      geometry.translate(-home.x, -home.y, -home.z)
      geometry.computeVertexNormals()
      home.sub(centre)
      // Outward from the skull's centre, with a little jitter.
      const dir = home
        .clone()
        .normalize()
        .add(
          new THREE.Vector3(rand(i, 1) - 0.5, rand(i, 2) - 0.5, rand(i, 3) - 0.5).multiplyScalar(
            0.6,
          ),
        )
        .normalize()
      return {
        name: mesh.name,
        geometry,
        home,
        dir,
        distance: size * (0.35 + rand(i, 4) * 0.35),
        spin: new THREE.Vector3(
          rand(i, 5) - 0.5,
          rand(i, 6) - 0.5,
          rand(i, 7) - 0.5,
        ).multiplyScalar(3),
        // Fossil bone tone with a slight per-bone shift, so the parts read apart.
        material: new THREE.MeshStandardMaterial({
          color: new THREE.Color('#d9c8a6').offsetHSL(0, 0, (rand(i, 8) - 0.5) * 0.08),
          roughness: 0.7,
          metalness: 0.02,
        }),
      }
    })
    return { bones, scale: 4.2 / size }
  }, [scene])
}

function Bones({ progress }: { progress: RefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const { size, gl } = useThree()
  const still = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const wide = size.width / size.height > 1.15
  const { bones, scale } = useBones()

  // "This is a skull" cues, pinned to real bones: the eye socket sits at the
  // centre of the bones that ring it. They fade out as the skull bursts.
  const callouts = useMemo(() => {
    const centre = (...names: string[]) => {
      const found = bones.filter((b) => names.includes(b.name))
      return found
        .reduce((sum, b) => sum.add(b.home), new THREE.Vector3())
        .divideScalar(Math.max(1, found.length))
    }
    return [
      {
        label: 'Eye socket',
        side: 'up',
        len: 96,
        at: centre('lacrimal_r', 'prefrontal_r', 'postorbital_r', 'jugal_r'),
      },
      { label: 'Snout', side: 'right', len: 56, at: centre('premaxilla_r') },
      { label: 'Lower jaw', side: 'down', len: 56, at: centre('surangular_l', 'angular_l') },
    ]
  }, [bones])

  // Drag a bone to spin the skull about its vertical axis only, with a little
  // momentum after release. Vertical drags are left to page scrolling.
  const spin = useRef({ yaw: 0, velocity: 0, dragging: false, lastX: 0, lastMove: 0 })
  useEffect(() => {
    const s = spin.current
    const move = (e: PointerEvent) => {
      if (!s.dragging) return
      const dx = e.clientX - s.lastX
      s.lastX = e.clientX
      s.lastMove = performance.now()
      s.velocity = dx * 0.01
      s.yaw += s.velocity
    }
    const up = () => {
      if (!s.dragging) return
      s.dragging = false
      // Held still before letting go: stay put instead of flinging.
      if (performance.now() - s.lastMove > 80) s.velocity = 0
      setCursor(gl.domElement, '')
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
    gl.domElement.addEventListener('lostpointercapture', up)
    return () => {
      gl.domElement.removeEventListener('lostpointercapture', up)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', up)
    }
  }, [gl])

  useFrame((state, delta) => {
    // Lift first (as in the reference), then burst outward.
    const t = progress.current ?? 0
    const burst = smoothstep((t - 0.12) / 0.75)
    bones.forEach((b, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      mesh.position.copy(b.home).addScaledVector(b.dir, b.distance * burst)
      mesh.rotation.set(b.spin.x * burst, b.spin.y * burst, b.spin.z * burst)
      // Palate bones clutter the side profile, so they grow in as it bursts.
      if (PALATE.has(b.name)) mesh.scale.setScalar(Math.max(0.001, smoothstep(burst * 3)))
    })
    const g = group.current
    if (!g) return
    const s = spin.current
    if (!s.dragging) {
      // Momentum in 60 fps units, so it coasts the same at any refresh rate.
      const frames = Math.min(delta * 60, 4)
      s.yaw += s.velocity * frames
      s.velocity *= 0.94 ** frames
    }
    // Labels only make sense near the side profile: fade them as it turns.
    const turned = Math.abs(Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw)))
    gl.domElement.parentElement?.style.setProperty('--spun', String(Math.min(1, turned * 2)))
    const sway = still ? 0 : Math.sin(state.clock.elapsedTime * 0.35) * 0.12
    // Base pose: right side profile, levelled, so the eye socket, snout and
    // jaw read as a skull at a glance (found by eye; the source does not
    // state its axis convention). Scroll and dragging turn it.
    g.rotation.set(t * 0.25, sway + s.yaw + t * 0.8, -0.6)
    // Sits upper right on wide screens, above the headline on narrow ones.
    g.position.set(wide ? 1.55 : 0, (wide ? 0.45 : 1.32) + smoothstep(t / 0.2) * 0.25, 0)
    g.scale.setScalar(scale * (wide ? 1 : 0.5))
  })

  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        spin.current.dragging = true
        spin.current.lastX = e.clientX
        spin.current.velocity = 0
        // Keep receiving moves and the release even outside the window.
        gl.domElement.setPointerCapture(e.pointerId)
        setCursor(gl.domElement, 'grabbing')
      }}
      onPointerOver={() => {
        if (!spin.current.dragging) setCursor(gl.domElement, 'grab')
      }}
      onPointerOut={() => {
        if (!spin.current.dragging) setCursor(gl.domElement, '')
      }}
    >
      {bones.map((b, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          geometry={b.geometry}
          material={b.material}
        />
      ))}
      {callouts.map((c) => (
        <Html
          key={c.label}
          position={c.at}
          zIndexRange={[1, 0]}
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <span
            className={`mk-callout mk-callout-${c.side}`}
            style={{ '--len': `${c.len}px` } as CSSProperties}
          >
            {c.label}
          </span>
        </Html>
      ))}
    </group>
  )
}

/** Shared canvas: transparent, with a warm key light and a cold CT-blue rim light. */
function Stage({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Canvas
      className={className}
      camera={{ position: [0, 0.2, 7], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      aria-hidden="true"
    >
      <hemisphereLight args={['#fff6e8', '#1a2328', 0.9]} />
      <directionalLight position={[-3, 4, 5]} intensity={2.4} color="#fff1dc" />
      <directionalLight position={[4, 1, -5]} intensity={3.2} color="#a9d0e6" />
      {children}
    </Canvas>
  )
}

export default function Skull({ progress }: { progress: RefObject<number> }) {
  return (
    <Stage className="mk-skull">
      <Bones progress={progress} />
    </Stage>
  )
}

/** The whole skull, assembled, turning slowly in the same side-profile tilt. */
function Turntable() {
  const group = useRef<THREE.Group>(null)
  const { bones, scale } = useBones()
  const still = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame((state) => {
    group.current?.rotation.set(0, still ? 0 : state.clock.elapsedTime * 0.4, -0.6)
  })
  return (
    <group ref={group} scale={scale * 1.55}>
      {bones.map((b, i) => (
        <mesh key={i} position={b.home} geometry={b.geometry} material={b.material} />
      ))}
    </group>
  )
}

/** Spinning preview for catalog cards. */
export function SkullPreview() {
  return (
    <Stage className="mk-card-skull">
      <Turntable />
    </Stage>
  )
}
