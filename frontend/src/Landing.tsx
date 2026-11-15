import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from './workspace/Workspace'
import './landing.css'

// three.js is large, so the hero skull loads after the page text.
const Skull = lazy(() => import('./Skull'))
const SkullPreview = lazy(() => import('./Skull').then((m) => ({ default: m.SkullPreview })))

/** The skull is decoration: if it fails (no WebGL, missing file), drop it, not the page. */
class SkipOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// ponytail: hard-coded catalog of the one curated specimen (spec §5), so these
// pages need no server. Fetch GET /specimens once the frontend uses it.
const curated = {
  id: 'ypm-vp-41198',
  scientificName: 'Eosphorosuchus lacrimosa',
  accession: 'YPM VP 41198',
  institution: 'Yale Peabody Museum',
  source: 'Dryad · CC0-1.0',
}
const catalog = [curated]
const openCurated = `/workspace/${curated.id}`

// Figures from docs/backend-specimen-setup.md (prepared Appendix 2 meshes).
const stats = [
  { value: '21', unit: 'elements', label: 'Named skull structures' },
  { value: '80k', unit: 'max', label: 'Triangles per mesh' },
  { value: 'CC0', unit: 'Dryad', label: 'Open data licence' },
  { value: '0', unit: 'installs', label: 'Runs in the browser' },
]

function Arrow() {
  return (
    <span className="mk-arrow">
      <Icon name="arrow" />
    </span>
  )
}

function Page(props: { title: string; children: ReactNode }) {
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
        <Link className="mk-btn mk-btn-light mk-nav-cta" to={openCurated}>
          Open specimen
          <Arrow />
        </Link>
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
              The real skull from the CT study of {curated.accession}.
            </p>
            <p className="mk-scroll-cue" aria-hidden="true">
              Scroll to take it apart
            </p>

            <div className="mk-hero-body">
              <div>
                <p className="mk-tag">[ CT study · {curated.accession} ]</p>
                <h1 className="mk-display">
                  A real fossil skull,
                  <br />
                  <span className="mk-dim">explored</span> bone by bone,
                  <br />
                  <span className="mk-dim">right in your</span> browser.
                </h1>
                <div className="mk-actions">
                  <Link className="mk-btn mk-btn-light" to={openCurated}>
                    Open the specimen
                    <Arrow />
                  </Link>
                  <Link className="mk-btn mk-btn-dark" to="/explore">
                    Browse the catalog
                  </Link>
                </div>
              </div>

              <ul className="mk-checks">
                <li>
                  <Icon name="check" />
                  Meshes the researchers extracted, not illustrations
                </li>
                <li>
                  <Icon name="check" />
                  Every bone traced to the published study
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
          <h2 id="mk-band-title">Specimen data from</h2>
          <ul>
            <li className="mk-serif">Yale Peabody Museum</li>
            <li>Dryad</li>
            <li className="mk-serif">Proceedings of the Royal Society B</li>
          </ul>
        </section>

        <section className="mk-about">
          <p className="mk-kicker">More about Marrow</p>
          <div className="mk-about-grid">
            <h2 className="mk-statement">
              Researcher-prepared CT anatomy, named, cited and ready to turn in your hand.
            </h2>
            <p className="mk-small">
              Marrow opens <i>{curated.scientificName}</i> ({curated.accession}) from a published
              micro-CT study. Select a bone, hide what is in the way, separate the parts and put
              them back. Missing or unreadable files are shown as missing, never replaced.
            </p>
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
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        Data: Margulis-Ohnuma, Ruebenstahl, Meyer &amp; Bhullar (2026), Dryad, CC0-1.0.
      </footer>
    </Page>
  )
}

function SpecimenMeta({ entry }: { entry: typeof curated }) {
  return (
    <dl className="mk-meta">
      <dt>Specimen</dt>
      <dd>{entry.accession}</dd>
      <dt>Collection</dt>
      <dd>{entry.institution}</dd>
      <dt>Data source</dt>
      <dd>{entry.source}</dd>
    </dl>
  )
}

export function Explore() {
  return (
    <Page title="Explore · Marrow">
      <main className="mk-page">
        <p className="mk-tag">[ Catalog ]</p>
        <h1 className="mk-display">Explore</h1>
        <p className="mk-lead">Fossil CT studies you can open in the 3D viewer.</p>
        <ul className="mk-catalog">
          {catalog.map((entry) => (
            <li key={entry.id}>
              <Link className="mk-card" to={`/workspace/${entry.id}`}>
                {/* ponytail: every card spins the curated skull; give each
                    specimen its own preview mesh when the catalog grows. */}
                <div className="mk-card-preview">
                  <SkipOnError>
                    <Suspense fallback={null}>
                      <SkullPreview />
                    </Suspense>
                  </SkipOnError>
                </div>
                <span className="mk-tag">[ CT study ]</span>
                <h2>
                  <i>{entry.scientificName}</i>
                </h2>
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
        <p className="mk-tag">[ Your own scan ]</p>
        <h1 className="mk-display">Upload</h1>
        <p className="mk-lead">Bring your own fossil CT scan and view it in the 3D viewer.</p>
        <div className="mk-drop">
          <Icon name="upload" />
          <strong>Uploading is not available yet</strong>
          <span>
            When it is, you will add your scan here and explore it with the same tools as the
            catalog specimens.
          </span>
          <button className="mk-btn mk-btn-light" disabled>
            Choose a scan
          </button>
        </div>
      </main>
    </Page>
  )
}
