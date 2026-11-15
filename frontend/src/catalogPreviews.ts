/**
 * Lightweight Explore-card meshes under frontend/public/.
 * Built offline from data/prepared/{id}/meshes with the same glTF-Transform
 * pipeline as Skull.tsx (merge → weld → simplify → meshopt). YPM reuses the
 * existing hero asset; others live in public/previews/{id}.glb.
 */
const base = import.meta.env.BASE_URL

export const CATALOG_PREVIEW_URLS: Readonly<Record<string, string>> = {
  'ypm-vp-41198': `${base}skull.glb`,
  'dino-15914': `${base}previews/dino-15914.glb`,
  'fmnh-pm9476': `${base}previews/fmnh-pm9476.glb`,
  'brsug-29950-14': `${base}previews/brsug-29950-14.glb`,
  'gik-991': `${base}previews/gik-991.glb`,
  'ivpp-v14010': `${base}previews/ivpp-v14010.glb`,
  'mrhnb-ig-8630': `${base}previews/mrhnb-ig-8630.glb`,
  'uamz-r636': `${base}previews/uamz-r636.glb`,
  'ummz-238306': `${base}previews/ummz-238306.glb`,
}

export function catalogPreviewUrl(specimenId: string): string | undefined {
  return CATALOG_PREVIEW_URLS[specimenId]
}
