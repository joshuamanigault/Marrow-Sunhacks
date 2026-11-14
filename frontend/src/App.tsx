import { useEffect, useState } from 'react'
import Workspace from './workspace/Workspace'
import { fetchSpecimen, type Specimen } from './workspace/specimen'
import SpecimenScene from './viewer/SpecimenScene'

// The one curated specimen (spec §5).
const SPECIMEN_ID = 'ypm-vp-41198'

const centered = { display: 'grid', placeItems: 'center', height: '100dvh', padding: 16 } as const

function App() {
  const [specimen, setSpecimen] = useState<Specimen>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const request = new AbortController()
    fetchSpecimen(SPECIMEN_ID, request.signal).then(setSpecimen, (e: unknown) => {
      if (request.signal.aborted) return
      // fetch() rejects with a TypeError when the server cannot be reached.
      setError(e instanceof TypeError ? 'The server is not reachable.' : String((e as Error).message))
    })
    return () => request.abort()
  }, [])

  if (error) {
    return (
      <main style={centered}>
        <div role="alert" style={{ textAlign: 'center' }}>
          <p>Could not load the specimen. {error}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      </main>
    )
  }
  if (!specimen) {
    return (
      <main style={centered}>
        <p role="status">Loading specimen…</p>
      </main>
    )
  }

  return <Workspace specimen={specimen} scene={<SpecimenScene specimen={specimen} />} />
}

export default App
