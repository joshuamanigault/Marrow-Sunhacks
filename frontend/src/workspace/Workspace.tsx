import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StatusBanner } from '../components/StatusBanner'
import { STATUS_COPY } from '../statusCopy'
import { usePins } from '../pins/store'
import type { PinObservation } from '../types/pins'
import { NATURAL_BONE, structureColor, structureLabel, type Specimen } from './specimen'
import { useViewer, type DisplayMode } from './viewer'
import AskPanel from '../ai/AskPanel'
import { useAiEnabled } from '../ai/api'
import { FirstOpenTip } from './FirstOpenTip'
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
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12l5 5 9-10" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
}

export function Icon({ name }: { name: keyof typeof icons }) {
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

type PanelId = 'info' | 'anatomy' | 'pins' | 'ask'

const tools: { id: PanelId; label: string; icon: keyof typeof icons }[] = [
  { id: 'info', label: 'Specimen information', icon: 'info' },
  { id: 'anatomy', label: 'Anatomy and display', icon: 'sliders' },
  { id: 'pins', label: 'Observations', icon: 'pin' },
]

// Shown only when the server has a Gemini key (spec §4: viewer works without AI).
const askTool = { id: 'ask', label: 'Ask about the fossil', icon: 'sparkle' } as const

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
              style={
                v.colorByStructure
                  ? { background: structureColor(s) ?? NATURAL_BONE }
                  : undefined
              }
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
                aria-label={v.focusedId === s.id ? `Stop focusing ${label}` : `Focus ${label}`}
                aria-pressed={v.focusedId === s.id}
                title={v.focusedId === s.id ? 'Stop focusing' : 'Focus: zoom in, explode and fade the rest'}
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

/** Status line while the dock has armed pin placement. */
function pickCaption(pick: { structureId: string } | null): string {
  return pick
    ? 'Type your note on the pin, then Save'
    : 'Click a bone to place a pin'
}

/** Grounded blurb from published study language (Alexandra task 2) — no invented bones. */
function lookingAtBlurb(specimen: Specimen): string {
  if (specimen.id.startsWith('upload-')) {
    return 'You are looking at a user-uploaded surface mesh converted to GLB. Anatomy, scale, orientation and source attribution have not been verified.'
  }
  const ready = specimen.structures.filter((s) => s.status === 'ok').length
  const blocked = specimen.structures.filter(
    (s) => s.status === 'missing' || s.status === 'unreadable',
  ).length
  return `You are looking at researcher-prepared 3D surfaces from the published dataset for ${specimen.accession}. ${ready} part(s) are ready to display; ${blocked} are missing or unreadable in the prepared inventory. See the citation and source for how these structures were scanned and reconstructed.`
}

function InfoPanel({ specimen }: { specimen: Specimen }) {
  return (
    <section aria-labelledby="ws-info-title">
      <h2 id="ws-info-title">Specimen information</h2>
      <h3>
        <i>{specimen.scientificName}</i>
      </h3>
      {specimen.commonLabel && <p className="ws-subtle">{specimen.commonLabel}</p>}
      <dl className="ws-meta">
        <dt>Specimen</dt>
        <dd>{specimen.accession}</dd>
        <dt>Collection</dt>
        <dd>{specimen.institution}</dd>
        <dt>Source coordinates</dt>
        <dd>{specimen.coordinates.notes}</dd>
        <dt>Data source</dt>
        <dd>
          {specimen.citation.datasetDoi ? `doi:${specimen.citation.datasetDoi} · ` : ''}
          {specimen.reuseTerms.license}
        </dd>
        <dt>Researchers</dt>
        <dd>{specimen.credits.join(', ') || 'Not supplied'}</dd>
        <dt>Citation</dt>
        <dd>{specimen.citation.text}</dd>
        {specimen.reuseTerms.notes && (
          <>
            <dt>Reuse</dt>
            <dd>{specimen.reuseTerms.notes}</dd>
          </>
        )}
      </dl>
      {/* Alexandra task 2: grounded “what you’re looking at” blurb */}
      <p className="ws-subtle">{lookingAtBlurb(specimen)}</p>
      {specimen.citation.datasetUrl && (
        <a className="ws-source" href={specimen.citation.datasetUrl} target="_blank" rel="noreferrer">
          View source dataset <Icon name="external" />
        </a>
      )}
    </section>
  )
}

/** Truncate note text for the list preview without inventing content. */
function notePreview(note: string, max = 72): string {
  const trimmed = note.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

/**
 * List of local pin observations for this specimen (spec §3.1 rail panel).
 * Focus opens the in-scene callout and frames the bone; Remove matches markers.
 */
function PinsPanel({ specimenId }: { specimenId: string }) {
  const v = useViewer()
  const pins = usePins((s) => s.pins)
  const activeId = usePins((s) => s.activeId)
  const setActive = usePins((s) => s.setActive)
  const remove = usePins((s) => s.remove)
  const specimenPins = pins.filter((p) => p.specimenId === specimenId)
  const count = specimenPins.length

  function openPin(pin: PinObservation) {
    setActive(pin.id)
    if (v.focusedId !== pin.structureId) v.focus(pin.structureId)
  }

  return (
    <section aria-labelledby="ws-pins-title">
      <h2 id="ws-pins-title">
        Observations{count > 0 ? ` (${count})` : ''}
      </h2>
      {v.pinning && (
        <p className="ws-subtle ws-pins-hint">
          Placement is armed — click a bone on the specimen, then save your note.
        </p>
      )}
      {count === 0 ? (
        <p className="ws-subtle">
          No observations yet. Use Pin observation in the dock, then click a bone.
        </p>
      ) : (
        <ul className="ws-pins" aria-label="Saved observations">
          {specimenPins.map((pin) => {
            const selected = activeId === pin.id
            const preview = notePreview(pin.note)
            return (
              <li key={pin.id} data-selected={selected || undefined}>
                <button
                  type="button"
                  className="ws-pin-open"
                  aria-pressed={selected}
                  aria-label={`Open observation on ${pin.structureLabel}: ${preview}`}
                  onClick={() => openPin(pin)}
                >
                  <span className="ws-name">{pin.structureLabel}</span>
                  <span className="ws-pin-note">{preview}</span>
                </button>
                <button
                  type="button"
                  className="ws-focus"
                  aria-label={`Focus ${pin.structureLabel}`}
                  aria-pressed={v.focusedId === pin.structureId && selected}
                  title="Focus: frame the bone and open this observation"
                  onClick={() => openPin(pin)}
                >
                  <Icon name="focus" />
                </button>
                <button
                  type="button"
                  className="ws-pin-remove"
                  aria-label={`Remove observation on ${pin.structureLabel}`}
                  title="Remove observation"
                  onClick={() => remove(specimenId, pin.id)}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

interface WorkspaceProps {
  specimen: Specimen
  /** The 3D canvas (Ananya). Fills the whole workspace behind the chrome. */
  scene: ReactNode
}

export default function Workspace({ specimen, scene }: WorkspaceProps) {
  const [panel, setPanel] = useState<PanelId | null>('anatomy')
  const v = useViewer()
  const serverAiEnabled = useAiEnabled()
  const aiEnabled = serverAiEnabled && Boolean(specimen.citation.datasetUrl)
  const pinCount = usePins((s) =>
    s.pins.filter((p) => p.specimenId === specimen.id).length,
  )
  const railTools = aiEnabled ? [...tools, askTool] : tools
  const selected = specimen.structures.find((s) => s.id === v.selectedId)
  const hiddenCount = Object.keys(v.hiddenIds).length
  const problemCount = specimen.structures.filter(
    (s) => s.status === 'missing' || s.status === 'unreadable',
  ).length
  const readyCount = specimen.structures.filter((s) => s.status === 'ok').length
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

  /**
   * Dock “Pin observation” arms place-a-pin mode: the next bone click opens a
   * floating note editor on the fossil. Press again to cancel.
   */
  function togglePinning() {
    v.setPinning(!v.pinning)
  }

  function setActivePanel(next: PanelId | null) {
    openedByUser.current = true
    setPanel(next)
  }

  return (
    <div className="ws" data-panel={panel ?? undefined}>
      <header className="ws-case ws-float">
        {/* Plain link, so the workspace does not need a router around it. */}
        <a href="/explore" aria-label="Back to specimen catalog" title="Back to catalog">
          <Icon name="arrow" />
          <span>Catalog</span>
        </a>
        <div>
          <strong>
            <i>{specimen.scientificName}</i>
          </strong>
          <span>
            {specimen.accession} · {specimen.commonLabel}
          </span>
        </div>
      </header>

      <nav className="ws-rail ws-float" aria-label="Workspace tools">
        {railTools.map((t) => {
          const label =
            t.id === 'pins' && pinCount > 0 ? `${t.label} (${pinCount})` : t.label
          return (
            <button
              key={t.id}
              type="button"
              aria-label={label}
              title={label}
              aria-expanded={panel === t.id}
              aria-controls="ws-panel"
              onClick={() => setActivePanel(panel === t.id ? null : t.id)}
            >
              <Icon name={t.icon} />
              {t.id === 'pins' && pinCount > 0 && (
                <span className="ws-rail-count" aria-hidden="true">
                  {pinCount > 9 ? '9+' : pinCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <main className="ws-stage" aria-label="Specimen view">
        <div className="ws-scene">{scene}</div>
        <div className="ws-caption" role="status">
          <span className="ws-dot" />
          <span>
            {v.pinning
              ? pickCaption(v.pick)
              : caption}
          </span>
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

      <div className="ws-dock-stack">
        <FirstOpenTip />
        <div className="ws-dock ws-float">
          <button type="button" onClick={v.reset}>
            <Icon name="home" />
            Reset view
          </button>
          <button
            type="button"
            aria-pressed={v.pinning}
            title={v.pinning ? 'Cancel pin placement' : 'Pin observation'}
            onClick={togglePinning}
          >
            <Icon name="pin" />
            {v.pinning ? 'Cancel pin' : 'Pin observation'}
          </button>
        </div>
      </div>

      {/* Last in the DOM so tab order matches the narrow layout. */}
      {panel && (
        <aside className="ws-panel ws-float" id="ws-panel" tabIndex={-1} ref={panelRef}>
          {panel === 'anatomy' && (
            <>
              {/* Alexandra task 3/6: honest mesh status summary (list already badges rows) */}
              {problemCount > 0 && (
                <StatusBanner kind="warning" title={STATUS_COPY.meshFailTitle}>
                  {STATUS_COPY.meshFailBody}
                </StatusBanner>
              )}
              {readyCount === 0 && specimen.structures.length > 0 && (
                <StatusBanner kind="warning" title={STATUS_COPY.meshNoneTitle}>
                  {STATUS_COPY.meshNoneBody}
                </StatusBanner>
              )}
              <AnatomyPanel specimen={specimen} />
            </>
          )}
          {panel === 'info' && <InfoPanel specimen={specimen} />}
          {panel === 'pins' && <PinsPanel specimenId={specimen.id} />}
          {panel === 'ask' && aiEnabled && <AskPanel specimen={specimen} />}
        </aside>
      )}
    </div>
  )
}
