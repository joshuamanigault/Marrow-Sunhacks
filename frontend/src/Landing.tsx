import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { catalogPreviewUrl } from './catalogPreviews'
import { Icon } from './workspace/Workspace'
import { UploadForm } from './uploads/UploadForm'
import { fetchSpecimens, type SpecimenListItem } from './workspace/specimen'
import './landing.css'

// three.js is large, so the hero skull loads after the page text.
const Skull = lazy(() => import('./Skull'))
const CatalogPreview = lazy(() => import('./Skull').then((m) => ({ default: m.CatalogPreview })))

/** Decoration that must not take down the page (no WebGL, missing/broken GLB). */
class SkipOnError extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

/**
 * Mount catalog WebGL only near the viewport so Explore does not open ~9
 * canvases at once (browsers cap concurrent WebGL contexts).
 */
function NearViewport({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      rootMargin: '120px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={host} style={{ position: 'absolute', inset: 0 }}>{near ? children : fallback}</div>
}

function AccessionFallback({ accession }: { accession: string }) {
  return <span className="mk-card-accession">{accession}</span>
}

/** Spinning static preview when a public/ asset exists; otherwise accession text. */
function ExploreCardPreview({ specimenId, accession }: { specimenId: string; accession: string }) {
  const url = catalogPreviewUrl(specimenId)
  const accessionText = <AccessionFallback accession={accession} />
  if (!url) return accessionText
  return (
    <SkipOnError fallback={accessionText}>
      <NearViewport fallback={accessionText}>
        <Suspense fallback={accessionText}>
          <CatalogPreview url={url} />
        </Suspense>
      </NearViewport>
    </SkipOnError>
  )
}

// The hero's bundled mesh depicts this specimen; it is an example of the collection.
const featured = {
  id: 'ypm-vp-41198',
  scientificName: 'Eosphorosuchus lacrimosa',
  accession: 'YPM VP 41198',
  institution: 'Yale Peabody Museum',
  source: 'Dryad · CC0-1.0',
}

// Figures from docs/backend-specimen-setup.md (prepared Appendix 2 meshes).
const stats = [
  { value: '3', unit: 'views', label: 'Solid, X-ray and exploded' },
  { value: '80k', unit: 'max', label: 'Triangles per mesh' },
  { value: 'CC0', unit: 'Dryad', label: 'Open data licence' },
  { value: '0', unit: 'installs', label: 'Runs in the browser' },
]

/** One visit path: the demo outcomes a judge can verify in a few minutes. */
const visitSteps = [
  {
    n: '01',
    title: 'Open a real specimen',
    body: 'Animal, museum accession and citation load with the mesh. Missing or unreadable parts are named, never replaced with illustrations.',
  },
  {
    n: '02',
    title: 'Inspect a named bone',
    body: 'Rotate, select and hide structures. Solid, X-ray and exploded views let you look past overlap without leaving the browser.',
  },
  {
    n: '03',
    title: 'Pin what you notice',
    body: 'Drop a note on a bone. It stays on the same anatomical point through reassembly, and comes back when you reopen the specimen here.',
  },
]

const trustPoints = [
  {
    title: 'Published evidence',
    body: 'Meshes come from open Dryad deposits tied to museum accessions, with researcher credits and reuse terms on every specimen.',
  },
  {
    title: 'Honest inventory',
    body: 'If a structure is missing or unreadable in the prepared set, Marrow says so. We do not invent anatomy to fill a gap.',
  },
  {
    title: 'No install, no account',
    body: 'Open a specimen in the browser, explore, pin observations locally. The workspace is usable without sign-in or specialist software.',
  },
]

function Arrow() {
  return (
    <span className="mk-arrow">
      <Icon name="arrow" />
    </span>
  )
}

/** Plays the section stagger once the block nears the viewport. */
function Reveal({
  children,
  className,
  id,
  'aria-labelledby': labelledBy,
}: {
  children: ReactNode
  className?: string
  id?: string
  'aria-labelledby'?: string
}) {
  const ref = useRef<HTMLSectionElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.setAttribute('data-in', '')
        io.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <section ref={ref} className={className} id={id} aria-labelledby={labelledBy}>
      {children}
    </section>
  )
}

function Page(props: { title: string; children: ReactNode }) {
  const { pathname } = useLocation()
  // Already on the catalog — the CTA would only send you here again.
  const showBrowseCta = pathname !== '/explore'

  return (
    <div className="mk">
      <title>{props.title}</title>
      {/* React hoists this into <head>, so only these pages load the font. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap"
        precedence="default"
      />
      <header className="mk-nav">
        <Link className="mk-brand" to="/">
          <Icon name="bone" />
          Marrow
        </Link>
        <nav className="mk-links" aria-label="Site">
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/upload">Upload</NavLink>
        </nav>
        {showBrowseCta && (
          <Link className="mk-btn mk-btn-light mk-nav-cta" to="/explore">
            Browse specimens
            <Arrow />
          </Link>
        )}
      </header>
      {props.children}
    </div>
  )
}

export function Landing() {
  // Scroll progress through the tall hero, 0..1: the skull reads it every
  // frame, and the overlay fades through the --t custom property.
  const scroller = useRef<HTMLElement>(null)
  const progress = useRef(0)
  useEffect(() => {
    const update = () => {
      const el = scroller.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const t = Math.min(1, Math.max(0, -box.top / (box.height - innerHeight)))
      progress.current = t
      el.style.setProperty('--t', String(t))
      // Once the hero text has faded out, take it out of clicks and tab order.
      el.toggleAttribute('data-faded', t > 0.45)
    }
    update()
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
    }
  }, [])

  return (
    <Page title="Marrow">
      <main>
        <section className="mk-scroll" ref={scroller}>
          <div className="mk-hero">
            {/* A CT gantry seen edge-on: two lit rims and the scan beam between them. */}
            <div className="mk-glow" aria-hidden="true">
              <div className="mk-arc mk-arc-top" />
              <div className="mk-arc mk-arc-bottom" />
              <div className="mk-beam" />
            </div>

            <SkipOnError>
              <Suspense fallback={null}>
                <Skull progress={progress} />
              </Suspense>
            </SkipOnError>
            <p className="mk-illustration">
              Featured: <i>{featured.scientificName}</i> · {featured.accession}.
            </p>
            <p className="mk-scroll-cue" aria-hidden="true">
              Scroll to take it apart
            </p>

            <div className="mk-hero-body">
              <div>
                <p className="mk-tag">[ An open anatomy collection ]</p>
                <h1 className="mk-display">
                  Real specimens,
                  <br />
                  <span className="mk-dim">explored</span> part by part,
                  <br />
                  <span className="mk-dim">right in your</span> browser.
                </h1>
                <div className="mk-actions">
                  <Link className="mk-btn mk-btn-light" to="/explore">
                    Explore the collection
                    <Arrow />
                  </Link>
                  <a className="mk-btn mk-btn-dark" href="#about">How it works</a>
                </div>
              </div>

              <ul className="mk-checks">
                <li>
                  <Icon name="check" />
                  Researcher-prepared meshes from published studies
                </li>
                <li>
                  <Icon name="check" />
                  Specimen identities, sources and credits included
                </li>
                <li>
                  <Icon name="check" />
                  Nothing to install, no sign-in
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mk-band" aria-labelledby="mk-band-title">
          <h2 id="mk-band-title">Built on open research</h2>
          <ul>
            <li className="mk-serif">Museum collections</li>
            <li>Dryad</li>
            <li className="mk-serif">Published studies</li>
          </ul>
        </section>

        <Reveal className="mk-why" id="about">
          <p className="mk-kicker">Why Marrow</p>
          <div className="mk-why-grid">
            <h2 className="mk-statement">
              Published CT anatomy rarely leaves the archive.
              <span className="mk-dim"> Marrow puts a curated specimen in your hands.</span>
            </h2>
            <p className="mk-why-lead">
              Micro-CT studies deposit named skull elements on Dryad, but students and
              museum visitors still need specialist software to open them. Marrow is a
              browser workspace for those prepared meshes: identity first, parts you can
              inspect, and a clear path back to the study they came from.
            </p>
          </div>
        </Reveal>

        <Reveal className="mk-visit" aria-labelledby="mk-visit-title">
          <div className="mk-visit-head">
            <p className="mk-kicker">A visit in three moves</p>
            <h2 id="mk-visit-title" className="mk-section-title">
              What you can prove in a few minutes
            </h2>
            <p className="mk-section-lead">
              Built for a short demo: open evidence, inspect a bone, leave a note you can
              return to. No upload, no account, nothing to install.
            </p>
          </div>
          <ol className="mk-steps">
            {visitSteps.map((step) => (
              <li key={step.n}>
                <span className="mk-step-n" aria-hidden="true">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="mk-trust" aria-labelledby="mk-trust-title">
          <div className="mk-trust-head">
            <p className="mk-kicker">Built on evidence</p>
            <h2 id="mk-trust-title" className="mk-section-title">
              Designed so the fossil stays the source of truth
            </h2>
          </div>
          <ul className="mk-trust-list">
            {trustPoints.map((point) => (
              <li key={point.title}>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </li>
            ))}
          </ul>
          <dl className="mk-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>
                  {s.value}
                  <sup>[{s.unit}]</sup>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal className="mk-close" aria-labelledby="mk-close-title">
          <p className="mk-kicker">Start here</p>
          <h2 id="mk-close-title" className="mk-statement">
            Open the featured skull, or browse the collection.
          </h2>
          <p className="mk-section-lead">
            Featured: <i>{featured.scientificName}</i> · {featured.accession} ·{' '}
            {featured.institution}. Source {featured.source}.
          </p>
          <div className="mk-actions">
            <Link className="mk-btn mk-btn-light" to={`/workspace/${featured.id}`}>
              Open featured specimen
              <Arrow />
            </Link>
            <Link className="mk-btn mk-btn-dark" to="/explore">
              Browse specimens
            </Link>
          </div>
        </Reveal>
      </main>

      <footer className="mk-footer">
        Featured mesh: Margulis-Ohnuma et al. (2026), Dryad, CC0-1.0.
        Every specimen carries its own citation and reuse terms.
      </footer>
    </Page>
  )
}

function SpecimenMeta({ entry }: { entry: SpecimenListItem }) {
  return (
    <dl className="mk-meta">
      <dt>Specimen</dt>
      <dd>{entry.accession}</dd>
      <dt>Collection</dt>
      <dd>{entry.institution || 'Not specified in source'}</dd>
    </dl>
  )
}

export function Explore() {
  const [catalog, setCatalog] = useState<SpecimenListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const request = new AbortController()
    fetchSpecimens(request.signal).then(
      (items) => {
        if (request.signal.aborted) return
        setCatalog(items)
        setLoading(false)
      },
      () => {
        if (request.signal.aborted) return
        setError('We could not reach the specimen catalog. Please try again.')
        setLoading(false)
      },
    )
    return () => request.abort()
  }, [attempt])

  const search = query.trim().toLocaleLowerCase()
  const results = catalog.filter((entry) =>
    [entry.scientificName, entry.commonLabel, entry.accession, entry.institution]
      .some((value) => value?.toLocaleLowerCase().includes(search)),
  )

  return (
    <Page title="Explore · Marrow">
      <main className="mk-page">
        <p className="mk-tag">[ Catalog ]</p>
        <h1 className="mk-display">Find your next discovery.</h1>
        <p className="mk-lead">
          Explore 3D anatomy from published research. Choose a specimen to begin;
          come back whenever you are ready for another.
        </p>
        <div className="mk-catalog-tools">
          <label className="mk-search">
            <span>Find a specimen</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, accessions or collections" />
          </label>
          {!loading && !error && (
            <p className="mk-count" role="status">
              {results.length} {results.length === 1 ? 'specimen' : 'specimens'}
              {search ? ` matching “${query.trim()}”` : ' ready to explore'}
            </p>
          )}
        </div>
        {loading && <p className="mk-catalog-status" role="status">Loading the collection…</p>}
        {error && (
          <div className="mk-catalog-status" role="alert">
            <p>{error}</p>
            <button className="mk-btn mk-btn-light" onClick={() => {
              setLoading(true)
              setError(undefined)
              setAttempt((n) => n + 1)
            }}>Try again</button>
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <p className="mk-catalog-status" role="status">
            {catalog.length === 0 ? 'The collection has no prepared specimens yet.' : 'No specimens match your search.'}
          </p>
        )}
        <ul className="mk-catalog">
          {!loading && !error && results.map((entry) => (
            <li key={entry.id}>
              <Link className="mk-card" to={`/workspace/${entry.id}`}>
                <div className="mk-card-preview">
                  <ExploreCardPreview specimenId={entry.id} accession={entry.accession} />
                </div>
                <span className="mk-tag">[ Research collection ]</span>
                <h2>
                  <i>{entry.scientificName}</i>
                </h2>
                <p className="mk-card-description">{entry.commonLabel}</p>
                <SpecimenMeta entry={entry} />
                <span className="mk-card-open">
                  Open in viewer <Icon name="arrow" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </Page>
  )
}

export function Upload() {
  return (
    <Page title="Upload · Marrow">
      <main className="mk-page">
        <p className="mk-tag">[ Your own mesh ]</p>
        <h1 className="mk-display">Upload</h1>
        <p className="mk-lead">Upload an STL or PLY mesh, convert it to GLB, and explore it in 3D.</p>
        <UploadForm />
      </main>
    </Page>
  )
}
