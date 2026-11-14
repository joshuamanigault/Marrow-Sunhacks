import type { SpecimenCredits } from "../specimen"

/**
 * Specimen information content for Alex’s info panel.
 *
 * Roadmap task 2 / spec §1 + §5:
 * animal, YPM accession, Dryad/citation link, researcher credits,
 * and a short blurb grounded in the real study.
 *
 * This is React copy/UI — not Three.js. Ananya’s canvas stays in the
 * stage; this panel sits in the shell so the fossil can stay in view
 * (spec §3.1: one contextual panel at a time).
 */
type SpecimenInfoPanelProps = {
  // Credits object loaded for the open specimen id
  credits: SpecimenCredits
}

export function SpecimenInfoPanel({ credits }: SpecimenInfoPanelProps) {
  // Join author names with commas + “&” before the last name
  const researcherLine = formatResearcherList(credits.researchers)

  return (
    // <aside> = complementary content next to the main 3D stage
    <aside className="specimen-info-panel" aria-label="Specimen information">
      {/* Panel title — matches preview “Specimen information” */}
      <h2 className="specimen-info-heading">Specimen information</h2>

      {/* Definition list: label (dt) + value (dd) pairs */}
      <dl className="specimen-info-list">
        {/* Animal */}
        <dt>Animal</dt>
        <dd>
          <em>{credits.scientificName}</em>
          {/* Extra plain label under the Latin name */}
          <span className="specimen-info-sub">{credits.commonLabel}</span>
        </dd>

        {/* Museum accession (YPM VP 41198) */}
        <dt>Specimen</dt>
        <dd>{credits.accession}</dd>

        {/* Holding collection */}
        <dt>Collection</dt>
        <dd>{credits.collection}</dd>

        {/* Geologic / locality context */}
        <dt>Period</dt>
        <dd>{credits.period}</dd>

        <dt>Locality</dt>
        <dd>{credits.locality}</dd>

        {/* Researcher credits */}
        <dt>Researchers</dt>
        <dd>{researcherLine}</dd>

        {/* Dryad / citation — clickable link opens in a new tab */}
        <dt>Citation</dt>
        <dd>
          <a
            href={credits.citationUrl}
            target="_blank"
            rel="noreferrer"
          >
            View on Dryad
          </a>
          {/* Full citation text for visitors who need to copy it */}
          <span className="specimen-info-sub">{credits.citation}</span>
        </dd>

        {/* License / reuse */}
        <dt>Data source</dt>
        <dd>
          {credits.dataSource}
          <span className="specimen-info-sub">{credits.reuse}</span>
        </dd>
      </dl>

      {/* “What you’re looking at” — grounded blurb, no invented bones */}
      <section className="specimen-info-blurb" aria-label="What you are looking at">
        <h3 className="specimen-info-blurb-title">What you are looking at</h3>
        <p>{credits.blurb}</p>
      </section>

      {/* Reminder for Alexandra task 4 — pins key off the same specimen id */}
      <p className="specimen-info-pin-note">
        Observations you pin later stay in this browser only, under specimen{" "}
        <code>{credits.id}</code>.
      </p>
    </aside>
  )
}

/**
 * Turn ["A", "B", "C", "D"] into "A, B, C & D"
 * so the researcher credit line reads naturally.
 */
function formatResearcherList(names: string[]): string {
  // No names → show a clear placeholder (should not happen for curated data)
  if (names.length === 0) {
    return "Not listed"
  }

  // One author → just that name
  if (names.length === 1) {
    return names[0]
  }

  // Two authors → "A & B"
  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`
  }

  // Three or more → "A, B, C & D"
  const allButLast = names.slice(0, -1).join(", ")
  const last = names[names.length - 1]
  return `${allButLast} & ${last}`
}
