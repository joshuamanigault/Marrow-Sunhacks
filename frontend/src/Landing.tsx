import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from './workspace/Workspace'
import './landing.css'

// ponytail: hard-coded catalog of the one curated specimen (spec §5), so these
// pages need no server. Fetch GET /specimens once that endpoint is on main.
const curated = {
  id: 'ypm-vp-41198',
  scientificName: 'Eosphorosuchus lacrimosa',
  accession: 'YPM VP 41198',
  institution: 'Yale Peabody Museum',
  source: 'Dryad · CC0-1.0',
}
const catalog = [curated]

const steps = [
  {
    icon: 'focus',
    title: 'Find a bone',
    text: 'Turn the specimen, pick a named structure and focus on it.',
  },
  {
    icon: 'sliders',
    title: 'Look behind it',
    text: 'Switch between Solid, X-ray and Exploded, or hide what is in the way.',
  },
  {
    icon: 'info',
    title: 'Know the source',
    text: 'Every structure comes from the published study, with its citation.',
  },
] as const

function Page(props: { title: string; className: string; children: ReactNode }) {
  return (
    <div className="ws landing">
      <title>{props.title}</title>
      <header className="landing-top">
        <Link className="landing-brand ws-float" to="/">
          <Icon name="bone" />
          <strong>Marrow</strong>
        </Link>
        <nav className="landing-nav ws-float" aria-label="Site">
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/upload">Upload</NavLink>
        </nav>
      </header>
      <main className={props.className}>{props.children}</main>
    </div>
  )
}

function SpecimenMeta({ entry }: { entry: typeof curated }) {
  return (
    <>
      <h2>
        <i>{entry.scientificName}</i>
      </h2>
      <dl className="ws-meta">
        <dt>Specimen</dt>
        <dd>{entry.accession}</dd>
        <dt>Collection</dt>
        <dd>{entry.institution}</dd>
        <dt>Data source</dt>
        <dd>{entry.source}</dd>
      </dl>
    </>
  )
}

export function Landing() {
  return (
    <Page title="Marrow" className="landing-main">
      <section className="landing-hero">
        <div className="ws-label">Fossil CT study</div>
        <h1>Explore a real fossil skull, bone by bone.</h1>
        <p>
          Marrow opens a published CT study in your browser. See the anatomy the researchers
          extracted, find a bone and inspect it in context. Nothing to install and no sign-in.
        </p>
        <Link className="ws-cta" to={`/workspace/${curated.id}`}>
          Open the specimen
        </Link>
      </section>

      <aside className="landing-card ws-float" aria-label="Curated specimen">
        <div className="ws-label">Curated specimen</div>
        <SpecimenMeta entry={curated} />
      </aside>

      <ul className="landing-steps">
        {steps.map((s) => (
          <li key={s.title}>
            <Icon name={s.icon} />
            <div>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  )
}

export function Explore() {
  return (
    <Page title="Explore · Marrow" className="landing-page">
      <div className="ws-label">Catalog</div>
      <h1>Explore</h1>
      <p>Fossil CT studies you can open in the 3D viewer.</p>
      <ul className="landing-catalog">
        {catalog.map((entry) => (
          <li key={entry.id}>
            <Link className="landing-card ws-float" to={`/workspace/${entry.id}`}>
              <div className="ws-label">CT study</div>
              <SpecimenMeta entry={entry} />
              <span className="landing-open">
                Open in viewer <Icon name="arrow" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}

export function Upload() {
  return (
    <Page title="Upload · Marrow" className="landing-page">
      <div className="ws-label">Your own scan</div>
      <h1>Upload</h1>
      <p>Bring your own fossil CT scan and view it in the 3D viewer.</p>
      <div className="landing-drop">
        <Icon name="upload" />
        <strong>Uploading is not available yet</strong>
        <span>
          When it is, you will add your scan here and explore it with the same tools as the catalog
          specimens.
        </span>
        <button className="ws-cta" disabled>
          Choose a scan
        </button>
      </div>
    </Page>
  )
}
