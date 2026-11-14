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
  structures: Structure[]
}

const API: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** Absolute URL for an API path such as a structure's meshUrl. */
export function apiUrl(path: string): string {
  return API + path
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

/**
 * The API sends no colors, so each structure gets an evenly spaced hue by its
 * position in the list. The panel swatch and the 3D scene should both use this.
 */
export function structureColor(index: number, count: number): string {
  return `hsl(${Math.round((index * 360) / count)} 35% 62%)`
}
