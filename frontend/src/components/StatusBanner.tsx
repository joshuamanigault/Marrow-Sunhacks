import { STATUS_COPY } from "../statusCopy"

/**
 * Shared plain-language banner for empty / error states (task 6).
 * Use for API down, mesh problems, and other visitor-facing notices.
 */
type StatusKind = "info" | "warning" | "error" | "empty"

type StatusBannerProps = {
  /** Visual tone */
  kind: StatusKind
  /** Short headline */
  title: string
  /** Plain-language explanation */
  children: string
  /** Optional retry button (e.g. API down) */
  onRetry?: () => void
  /** Accessible role — errors use alert */
  role?: "status" | "alert"
}

export function StatusBanner({
  kind,
  title,
  children,
  onRetry,
  role = kind === "error" ? "alert" : "status",
}: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${kind}`} role={role}>
      {/* Headline visitors see first */}
      <p className="status-banner-title">{title}</p>
      {/* Supporting sentence in plain language */}
      <p className="status-banner-body">{children}</p>
      {/* Optional retry — only for recoverable cases like API down */}
      {onRetry && (
        <button type="button" className="status-banner-retry" onClick={onRetry}>
          {STATUS_COPY.apiDownRetry}
        </button>
      )}
    </div>
  )
}
