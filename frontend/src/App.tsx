import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Explore, Landing, Upload } from './Landing'
import Workspace from './workspace/Workspace'
import { fetchSpecimen, type Specimen } from './workspace/specimen'

function SpecimenWorkspace({ specimenId, onRetry }: { specimenId: string; onRetry: () => void }) {
  const [specimen, setSpecimen] = useState<Specimen>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const request = new AbortController()
    fetchSpecimen(specimenId, request.signal).then(setSpecimen, (e: unknown) => {
      if (request.signal.aborted) return
      // fetch() rejects with a TypeError when the server cannot be reached.
      setError(e instanceof TypeError ? 'The server is not reachable.' : String((e as Error).message))
    })
    return () => request.abort()
  }, [specimenId])

  if (error) {
    return (
      <main className="ws ws-center">
        <div role="alert">
          <p>Could not load the specimen. {error}</p>
          <button className="ws-cta" onClick={onRetry}>
            Try again
          </button>
          <p>
            <Link to="/">Back to start</Link>
          </p>
        </div>
      </main>
    )
  }
  if (!specimen) {
    return (
      <main className="ws ws-center">
        <p role="status">Loading specimen…</p>
      </main>
    )
  }

  // The 3D canvas replaces this placeholder.
  const scene = (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', opacity: 0.5 }}>
      3D scene mounts here
    </div>
  )
  return (
    <>
      <title>{`${specimen.scientificName} · Marrow`}</title>
      <Workspace specimen={specimen} scene={scene} />
    </>
  )
}

function WorkspaceRoute() {
  const { specimenId = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  // The key remounts the workspace for another specimen or a retry, so no
  // specimen or error from the previous load is left on screen.
  return (
    <SpecimenWorkspace
      key={`${specimenId}:${attempt}`}
      specimenId={specimenId}
      onRetry={() => setAttempt(attempt + 1)}
    />
  )
}

// / and /workspace/:specimenId match Alexandra's start-page branch.
// Deployment note: the host must serve index.html for every path (SPA
// fallback), or refreshing /explore or a /workspace link returns its 404.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/workspace/:specimenId" element={<WorkspaceRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
