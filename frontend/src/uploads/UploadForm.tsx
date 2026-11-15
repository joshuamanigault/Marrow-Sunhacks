import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiUrl } from '../workspace/specimen'
import './upload.css'

interface Job {
  id: string
  status: 'processing' | 'ready' | 'failed'
  specimenId: string | null
  error: string | null
}

const MAX_BYTES = 100 * 1024 * 1024

export function UploadForm() {
  const [file, setFile] = useState<File>()
  const [progress, setProgress] = useState<number>()
  const [job, setJob] = useState<Job>()
  const [error, setError] = useState('')
  const xhr = useRef<XMLHttpRequest | null>(null)
  const navigate = useNavigate()
  const busy = progress !== undefined || job?.status === 'processing'

  useEffect(() => () => xhr.current?.abort(), [])

  useEffect(() => {
    if (job?.status !== 'processing') return
    const jobId = job.id
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    async function poll() {
      try {
        const response = await fetch(apiUrl(`/uploads/${jobId}`), { signal: controller.signal })
        if (!response.ok) throw new Error('Unable to check conversion status. Try uploading again.')
        const result: Job = await response.json()
        if (controller.signal.aborted) return
        if (result.status === 'ready' && result.specimenId) {
          setJob(result)
          navigate(`/workspace/${result.specimenId}`)
        } else if (result.status === 'failed') {
          setJob(result)
          setError(result.error || 'Conversion failed. Try a different mesh.')
        } else if (Date.now() - started > 10 * 60 * 1000) {
          setJob(undefined)
          setError('Conversion is taking longer than expected. You can check Explore later or upload again.')
        } else {
          timer = setTimeout(poll, 1000)
        }
      } catch (reason) {
        if (controller.signal.aborted) return
        setJob(undefined)
        setError(reason instanceof TypeError ? 'The server could not be reached. Try again.' : (reason as Error).message)
      }
    }
    timer = setTimeout(poll, 500)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [job, navigate])

  function submit() {
    if (!file || busy) return
    setError('')
    setJob(undefined)
    if (!/\.(stl|ply)$/i.test(file.name) || file.size === 0 || file.size > MAX_BYTES) {
      setError('Choose a nonempty STL or PLY file, up to 100 MB.')
      return
    }
    const request = new XMLHttpRequest()
    xhr.current = request
    setProgress(0)
    request.open('POST', apiUrl(`/uploads?filename=${encodeURIComponent(file.name)}`))
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.timeout = 5 * 60 * 1000
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100))
    }
    request.onload = () => {
      setProgress(undefined)
      try {
        const result = JSON.parse(request.responseText)
        if (request.status !== 202) {
          setError(typeof result.detail === 'string' ? result.detail : 'Upload failed. Try again.')
        } else {
          setJob(result)
        }
      } catch {
        setError('The upload server returned an unexpected response.')
      }
    }
    request.onerror = () => {
      setProgress(undefined)
      setError('The server could not be reached. Try again.')
    }
    request.ontimeout = () => {
      setProgress(undefined)
      setError('The upload timed out. Try again.')
    }
    request.send(file)
  }

  return (
    <form className="mk-drop upload-form" onSubmit={(event) => {
      event.preventDefault()
      submit()
    }}>
      <label htmlFor="mesh-file">Choose a 3D mesh</label>
      <p id="mesh-help">STL or PLY · One file at a time · Up to 100 MB</p>
      <input
        id="mesh-file"
        type="file"
        accept=".stl,.ply"
        disabled={busy}
        aria-describedby="mesh-help"
        onChange={(event) => {
          setFile(event.target.files?.[0])
          setError('')
          setJob(undefined)
        }}
      />
      <p>Original coordinates are preserved. File names become labels; anatomy is not identified automatically.</p>
      <p>Completed uploads appear in Explore and are accessible to anyone using this server.</p>
      <button type="submit" className="mk-btn mk-btn-light" disabled={!file || busy}>
        {busy ? 'Preparing your mesh…' : 'Upload and open in viewer'}
      </button>
      {progress !== undefined && (
        <div role="status">
          Uploading: {progress}%
          <progress max={100} value={progress} aria-label="File upload progress" />
        </div>
      )}
      {job?.status === 'processing' && (
        <p role="status">Converting to GLB. This may take a few minutes…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {job?.status === 'ready' && <Link to={`/workspace/${job.specimenId}`}>Open your mesh</Link>}
    </form>
  )
}
