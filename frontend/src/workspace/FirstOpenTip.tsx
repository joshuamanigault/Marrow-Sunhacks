import { useState } from 'react'

/** Once-per-browser coaching for the pin loop (Marrow workspace first visit). */
export const PIN_LOOP_TIP_KEY = 'marrow:tip:pin-loop'

function tipDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(PIN_LOOP_TIP_KEY) === '1'
  } catch {
    return false
  }
}

function persistDismissed(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PIN_LOOP_TIP_KEY, '1')
  } catch {
    /* private mode / quota — still hide for this session */
  }
}

/**
 * Slim dismissible tip above the dock. Does not block pin placement.
 * Spec §3.1: coaching chrome, not a card wall over the specimen.
 */
export function FirstOpenTip() {
  const [visible, setVisible] = useState(() => !tipDismissed())

  if (!visible) return null

  function dismiss() {
    persistDismissed()
    setVisible(false)
  }

  return (
    <aside className="ws-tip ws-float" role="status" aria-label="Pin observation tip">
      <p className="ws-tip-text">
        <span className="ws-tip-primary">
          Pin observation → click a bone → Save
        </span>
        <span className="ws-tip-secondary">
          Explode helps placement; reopen notes in Observations.
        </span>
      </p>
      <button
        type="button"
        className="ws-tip-dismiss"
        aria-label="Dismiss tip"
        onClick={dismiss}
      >
        Got it
      </button>
    </aside>
  )
}
