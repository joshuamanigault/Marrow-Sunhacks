// STUB: replace with GET /specimens/{id} from Joshua's API.
// Identity fields come from docs/spec.md §5. Structure rows are placeholders,
// not real anatomy — the demo must run on the real inventory.

export type StructureStatus = 'ok' | 'missing' | 'unreadable'

export interface Structure {
  /** Stable structure id; never the display name. */
  id: string
  name: string
  side: 'L' | 'R' | null
  /** Structure color; null falls back to the bone tone. */
  color: string | null
  status: StructureStatus
  /** File in the published dataset this structure came from (spec §5). */
  sourceFile: string
  /** Public URL of the web-ready mesh; null unless status is 'ok'. */
  meshUrl: string | null
}

export interface Specimen {
  id: string
  taxon: string
  accession: string
  institution: string
  /** Repository name, e.g. 'Dryad'. */
  sourceName: string
  sourceUrl: string
  license: string
  citation: string
  structures: Structure[]
}

export function structureLabel(s: Structure): string {
  return s.side ? `${s.name} (${s.side})` : s.name
}

export const stubSpecimen: Specimen = {
  id: 'ypm-vp-41198',
  taxon: 'Eosphorosuchus lacrimosa',
  accession: 'YPM VP 41198',
  institution: 'Yale Peabody Museum',
  sourceName: 'Dryad',
  sourceUrl: 'https://datadryad.org/dataset/doi:10.5061/dryad.q83bk3jvv',
  license: 'CC0-1.0',
  citation: 'Margulis-Ohnuma, Ruebenstahl, Meyer & Bhullar (2026), Dryad dataset',
  structures: [
    {
      id: 'stub-a-l',
      name: 'Stub structure A',
      side: 'L',
      color: '#b0c4c5',
      status: 'ok',
      sourceFile: 'stub-a-l.stl',
      meshUrl: null,
    },
    {
      id: 'stub-a-r',
      name: 'Stub structure A',
      side: 'R',
      color: '#c5aa83',
      status: 'ok',
      sourceFile: 'stub-a-r.stl',
      meshUrl: null,
    },
    {
      id: 'stub-b',
      name: 'Stub structure B',
      side: null,
      color: '#bd968a',
      status: 'ok',
      sourceFile: 'stub-b.stl',
      meshUrl: null,
    },
    {
      id: 'stub-c',
      name: 'Stub structure C',
      side: null,
      color: null,
      status: 'ok',
      sourceFile: 'stub-c.stl',
      meshUrl: null,
    },
    {
      id: 'stub-d',
      name: 'Stub structure D',
      side: null,
      color: '#aca78c',
      status: 'missing',
      sourceFile: 'stub-d.stl',
      meshUrl: null,
    },
    {
      id: 'stub-e',
      name: 'Stub structure E',
      side: null,
      color: null,
      status: 'unreadable',
      sourceFile: 'stub-e.stl',
      meshUrl: null,
    },
  ],
}
