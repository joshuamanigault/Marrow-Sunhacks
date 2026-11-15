// Specimen data from Joshua's API. Shapes follow docs/api/specimen-contract.md.

export type StructureStatus = 'ok' | 'missing' | 'unreadable'

export interface Structure {
  /** Stable structure id (e.g. 'maxilla_l'); never the display name. */
  id: string
  name: string
  side: 'left' | 'right' | 'none'
  /** File in the published dataset this structure came from (spec §5). */
  sourceFilename: string
  status: StructureStatus
  /**
   * Stable #rrggbb for swatches and color-by-structure, or null when unknown.
   * Fall back to natural bone tone when null (docs/api/specimen-contract.md).
   */
  color: string | null
  /** Path on the API host; pass through apiUrl(). Only set when status is 'ok'. */
  meshUrl?: string | null
  triangleCount?: number | null
  /** In source STL space, like the mesh vertices. */
  bounds?: { min: number[]; max: number[] } | null
}

export interface Specimen {
  id: string
  scientificName: string
  commonLabel: string
  accession: string
  institution: string
  citation: {
    text: string
    datasetDoi: string
    datasetUrl: string
    articleDoi?: string | null
    articleUrl?: string | null
  }
  /** Researchers who published the study. */
  credits: string[]
  reuseTerms: { license: string; licenseUrl: string; notes: string }
  coordinates: { notes: string }
  structures: Structure[]
}

/** The compact discovery response from GET /specimens. */
export interface SpecimenListItem {
  id: string
  scientificName: string
  commonLabel: string
  accession: string
  institution: string | null
}

const API: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** Absolute URL for an API path such as a structure's meshUrl. */
export function apiUrl(path: string): string {
  return API.replace(/\/$/, '') + path
}

export async function fetchSpecimens(signal?: AbortSignal): Promise<SpecimenListItem[]> {
  const res = await fetch(apiUrl('/specimens'), { signal })
  if (!res.ok) throw new Error(`The catalog server answered ${res.status}.`)
  return res.json()
}

export async function fetchSpecimen(id: string, signal?: AbortSignal): Promise<Specimen> {
  const res = await fetch(apiUrl(`/specimens/${encodeURIComponent(id)}`), { signal })
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'The server has no prepared data for this specimen.'
        : `The server answered ${res.status}.`,
    )
  }
  return res.json()
}

export function structureLabel(s: Structure): string {
  return s.side === 'none' ? s.name : `${s.name} (${s.side === 'left' ? 'L' : 'R'})`
}

/** Natural bone tone when structure.color is null (matches Bone.tsx). */
export const NATURAL_BONE = '#d9cba9'

/**
 * Stable API color for list swatches and color-by-structure.
 * Returns null when unknown — callers should use NATURAL_BONE.
 */
export function structureColor(s: Structure): string | null {
  return s.color
}
