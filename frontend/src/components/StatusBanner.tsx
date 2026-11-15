import { STATUS_COPY } from '../statusCopy'

type StatusKind = 'info' | 'warning' | 'error' | 'empty'

type StatusBannerProps = {
  kind: StatusKind
  title: string
  children: string
  onRetry?: () => void
  role?: 'status' | 'alert'
}

export function StatusBanner({
  kind,
  title,
  children,
  onRetry,
  role = kind === 'error' ? 'alert' : 'status',
}: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${kind}`} role={role}>
      <p className="status-banner-title">{title}</p>
      <p className="status-banner-body">{children}</p>
      {onRetry && (
        <button type="button" className="status-banner-retry" onClick={onRetry}>
          {STATUS_COPY.apiDownRetry}
        </button>
      )}
    </div>
  )
}
