import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBanner } from '../components/StatusBanner'
import { STATUS_COPY } from '../statusCopy'
import Workspace from '../workspace/Workspace'
import { fetchSpecimen, type Specimen } from '../workspace/specimen'

/**
 * Loads Joshua’s specimen from the API, then mounts Alex’s Workspace.
 * Plain-language errors for API down / missing specimen (task 6).
 */
export function WorkspaceRoute() {
  const { specimenId } = useParams<{ specimenId: string }>()
  const [specimen, setSpecimen] = useState<Specimen>()
  const [error, setError] = useState<string>()
  const [retryCount, setRetryCount] = useState(0)

  const retry = useCallback(() => {
    setError(undefined)
    setSpecimen(undefined)
    setRetryCount((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!specimenId) {
      setError(STATUS_COPY.loadErrorBody)
      return
    }

    const request = new AbortController()
    fetchSpecimen(specimenId, request.signal).then(
      (data) => setSpecimen(data),
      (e: unknown) => {
        if (request.signal.aborted) return
        // fetch() rejects with TypeError when the server cannot be reached.
        setError(
          e instanceof TypeError
            ? STATUS_COPY.apiDownBody
            : String((e as Error).message),
        )
      },
    )
    return () => request.abort()
  }, [specimenId, retryCount])

  if (error) {
    return (
      <main className="load-screen">
        <div style={{ maxWidth: 28 * 16 }}>
          <StatusBanner
            kind="error"
            title={
              error === STATUS_COPY.apiDownBody
                ? STATUS_COPY.apiDownTitle
                : STATUS_COPY.loadErrorTitle
            }
            onRetry={retry}
          >
            {error}
          </StatusBanner>
          <p>
            <Link to={`/workspace/${specimenId ?? 'ypm-vp-41198'}`}>
              ← Back to specimen
            </Link>
          </p>
        </div>
      </main>
    )
  }

  if (!specimen) {
    return (
      <main className="load-screen">
        <p role="status">{STATUS_COPY.loading}</p>
      </main>
    )
  }

  // Ananya’s Three.js canvas replaces this placeholder.
  const scene = (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        opacity: 0.5,
      }}
    >
      3D scene mounts here
    </div>
  )

  return <Workspace specimen={specimen} scene={scene} />
}
