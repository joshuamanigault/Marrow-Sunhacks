import { Box3, Color, SRGBColorSpace, Vector3 } from 'three'
import type { Specimen, Structure } from '../workspace/specimen'

// Positions here are in specimen / source STL space (docs/api/specimen-contract.md).
// Meshes arrive with identity transforms, so a bone at offset (0,0,0) sits exactly
// where the researchers placed it.

/** How far Exploded pushes a bone at separation 1, as a multiple of its distance from the specimen center. */
export const EXPLODE_GAIN = 1

export function structureBox(s: Structure): Box3 | null {
  const b = s.bounds
  if (!b || b.min.length !== 3 || b.max.length !== 3) return null
  return new Box3(new Vector3(...b.min), new Vector3(...b.max))
}

/** Box around every loadable bone, in its authored (assembled) position. */
export function specimenBox(specimen: Specimen): Box3 {
  const box = new Box3()
  for (const s of specimen.structures) {
    if (s.status !== 'ok') continue
    const b = structureBox(s)
    if (b) box.union(b)
  }
  return box
}

/**
 * Explode offset for one bone: straight out from `origin` through the bone's
 * own center. Zero separation always gives exactly (0, 0, 0).
 */
export function explodeOffset(
  s: Structure,
  origin: Vector3,
  separation: number,
  out = new Vector3(),
): Vector3 {
  const b = structureBox(s)
  if (!b || separation === 0) return out.set(0, 0, 0)
  return b.getCenter(out).sub(origin).multiplyScalar(separation * EXPLODE_GAIN)
}

/**
 * Where Exploded pushes from: the specimen center normally, or the focused
 * bone's own center, so the focused bone stays put and the rest clear away.
 */
export function explodeOrigin(specimen: Specimen, focusedId: string | null, specimenCenter: Vector3): Vector3 {
  const focused = focusedId ? specimen.structures.find((x) => x.id === focusedId) : undefined
  const box = focused && structureBox(focused)
  return box ? box.getCenter(new Vector3()) : specimenCenter
}

/**
 * Same hue as the panel swatch from structureColor(): three can't parse its
 * space-separated hsl() string, so build the color directly.
 */
export function boneColor(index: number, count: number): Color {
  return new Color().setHSL(Math.round((index * 360) / count) / 360, 0.35, 0.62, SRGBColorSpace)
}
