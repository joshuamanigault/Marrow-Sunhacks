import { useEffect, useRef, useState, type ReactNode } from 'react'
import { structureLabel, type Specimen } from './specimen'
import { useViewer, type DisplayMode } from './viewer'
import './workspace.css'

const icons = {
  bone: (
    <>
      <path d="M8.5 15.5l7-7" />
      <circle cx="6" cy="15" r="2.5" />
      <circle cx="9" cy="18" r="2.5" />
      <circle cx="15" cy="6" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M3 6h10M17 6h4M3 12h4M11 12h10M3 18h12M19 18h2" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  note: <path d="M4 4h16v12H9l-5 4z" />,
  focus: (
    <>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  rotateLeft: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />,
  rotateRight: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />,
  external: <path d="M7 17L17 7M8 7h9v9" />,
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  )
}

type PanelId = 'info' | 'anatomy' | 'notes'

const tools: { id: PanelId; label: string; icon: keyof typeof icons }[] = [
  { id: 'info', label: 'Specimen information', icon: 'info' },
  { id: 'anatomy', label: 'Anatomy and display', icon: 'sliders' },
  { id: 'notes', label: 'Observations', icon: 'note' },
]

const modes: { id: DisplayMode; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'xray', label: 'X-ray' },
  { id: 'exploded', label: 'Exploded' },
]

const ROTATE_STEP = Math.PI / 12

function AnatomyPanel({ specimen }: { specimen: Specimen }) {
  const v = useViewer()
  const percent = Math.round(v.separation * 100)
  return (
    <section aria-labelledby="ws-anatomy-title">
      <h2 id="ws-anatomy-title">Anatomy &amp; display</h2>
      <div className="ws-label" id="ws-display-label">
        Specimen display
      </div>
      <div className="ws-segments" role="group" aria-labelledby="ws-display-label">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={v.mode === m.id}
            onClick={() => v.setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="ws-range-label" htmlFor="ws-separation">
        Separate structures <output>{percent}%</output>
      </label>
      <input
        id="ws-separation"
        type="range"
        min={0}
        max={100}
        value={percent}
        disabled={v.mode !== 'exploded'}
        onChange={(e) => v.setSeparation(Number(e.target.value) / 100)}
      />
      <div className="ws-line" />
      <div className="ws-label">Structures</div>
      <ul className="ws-structures">
        {specimen.structures.map((s) => {
          const label = structureLabel(s)
          const swatch = (
            <span
              className="ws-swatch"
              style={v.colorByStructure && s.color ? { background: s.color } : undefined}
            />
          )
          if (s.status !== 'ok') {
            // Honest asset status (spec §2): named, never faked, not interactive.
            return (
              <li key={s.id}>
                {swatch}
                <span className="ws-name">{label}</span>
                <span className="ws-status">{s.status}</span>
              </li>
            )
          }
          return (
            <li key={s.id} data-selected={v.selectedId === s.id}>
              <input
                type="checkbox"
                aria-label={`Show ${label}`}
                checked={!v.hiddenIds[s.id]}
                onChange={(e) => v.setVisible(s.id, e.target.checked)}
              />
              {swatch}
              <button
                type="button"
                className="ws-name"
                aria-pressed={v.selectedId === s.id}
                onClick={() => v.select(v.selectedId === s.id ? null : s.id)}
              >
                {label}
              </button>
              <button
                type="button"
                className="ws-focus"
                aria-label={`Focus ${label}`}
                onClick={() => v.focus(s.id)}
              >
                <Icon name="focus" />
              </button>
            </li>
          )
        })}
      </ul>
      <label className="ws-check">
        <input
          type="checkbox"
          checked={v.colorByStructure}
          onChange={(e) => v.setColorByStructure(e.target.checked)}
        />
        Color by structure
      </label>
    </section>
  )
}

function InfoPanel({ specimen }: { specimen: Specimen }) {
  return (
    <section aria-labelledby="ws-info-title">
      <h2 id="ws-info-title">Specimen information</h2>
      <h3>
        <i>{specimen.taxon}</i>
      </h3>
      <dl className="ws-meta">
        <dt>Specimen</dt>
        <dd>{specimen.accession}</dd>
        <dt>Collection</dt>
        <dd>{specimen.institution}</dd>
        <dt>Data source</dt>
        <dd>
          {specimen.sourceName} · {specimen.license}
        </dd>
        <dt>Citation</dt>
        <dd>{specimen.citation}</dd>
      </dl>
      {/* SLOT (Alexandra): "what you're looking at" blurb grounded in the study. */}
      <a className="ws-source" href={specimen.sourceUrl} target="_blank" rel="noreferrer">
        View source dataset <Icon name="external" />
      </a>
    </section>
  )
}

interface WorkspaceProps {
  specimen: Specimen
  /** The 3D canvas (Ananya). Fills the whole workspace behind the chrome. */
  scene: ReactNode
  /**
   * Starts the pin flow (Alexandra). The dock button is disabled without it.
   * The picked bone and bone-space point are in `useViewer.getState().pick`.
   */
  onPin?: () => void
}

export default function Workspace({ specimen, scene, onPin }: WorkspaceProps) {
  const [panel, setPanel] = useState<PanelId | null>('anatomy')
  const v = useViewer()
  const selected = specimen.structures.find((s) => s.id === v.selectedId)
  const hiddenCount = Object.keys(v.hiddenIds).length
  const caption = selected
    ? structureLabel(selected)
    : hiddenCount
      ? `${hiddenCount} hidden`
      : 'All structures visible'

  // The panel is last in the DOM (so tab order matches the narrow layout);
  // opening it from the rail moves focus into it so keyboard users land there.
  const panelRef = useRef<HTMLElement>(null)
  const openedByUser = useRef(false)
  useEffect(() => {
    if (openedByUser.current && panel) panelRef.current?.focus()
  }, [panel])

  return (
    <div className="ws" data-panel={panel ?? undefined}>
      <header className="ws-case ws-float">
        <Icon name="bone" />
        <div>
          <strong>
            <i>{specimen.taxon}</i>
          </strong>
          <span>
            {specimen.accession} · {specimen.sourceName}
          </span>
        </div>
      </header>

      <nav className="ws-rail ws-float" aria-label="Workspace tools">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            title={t.label}
            aria-expanded={panel === t.id}
            aria-controls="ws-panel"
            onClick={() => {
              openedByUser.current = true
              setPanel(panel === t.id ? null : t.id)
            }}
          >
            <Icon name={t.icon} />
          </button>
        ))}
      </nav>

      <main className="ws-stage" aria-label="Specimen view">
        <div className="ws-scene">{scene}</div>
        <div className="ws-caption" role="status">
          <span className="ws-dot" />
          <span>{caption}</span>
        </div>
        <div className="ws-rotation">
          <button
            type="button"
            aria-label="Rotate specimen left"
            onClick={() => v.rotateBy(-ROTATE_STEP)}
          >
            <Icon name="rotateLeft" />
          </button>
          <button
            type="button"
            aria-label="Rotate specimen right"
            onClick={() => v.rotateBy(ROTATE_STEP)}
          >
            <Icon name="rotateRight" />
          </button>
        </div>
      </main>

      <div className="ws-dock ws-float">
        <button type="button" onClick={v.reset}>
          <Icon name="home" />
          Reset view
        </button>
        <button
          type="button"
          disabled={!onPin}
          title={onPin ? undefined : 'Pinning arrives with observations'}
          onClick={onPin}
        >
          <Icon name="pin" />
          Pin observation
        </button>
      </div>

      {/* Last in the DOM so tab order matches the narrow layout. */}
      {panel && (
        <aside className="ws-panel ws-float" id="ws-panel" tabIndex={-1} ref={panelRef}>
          {panel === 'anatomy' && <AnatomyPanel specimen={specimen} />}
          {panel === 'info' && <InfoPanel specimen={specimen} />}
          {panel === 'notes' && (
            <section aria-labelledby="ws-notes-title">
              <h2 id="ws-notes-title">Observations</h2>
              {/* SLOT (Alexandra): pinned-observation list. */}
              <p className="ws-subtle">Pinned observations will appear here.</p>
            </section>
          )}
        </aside>
      )}
    </div>
  )
}
