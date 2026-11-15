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

type UploadTarget =
  | { mode: 'local' }
  | { mode: 'direct'; id: string; url: string; fields: Record<string, string> }

function sendMesh(
  file: File, target: UploadTarget, signal: AbortSignal, onProgress: (value: number) => void,
): Promise<Job> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    const direct = target.mode === 'direct'
    request.open('POST', direct ? target.url : apiUrl(`/uploads?filename=${encodeURIComponent(file.name)}`))
    request.timeout = 5 * 60 * 1000
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100))
    }
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        let detail = 'Upload failed. Try again.'
        if (!direct) {
          try {
            const body = JSON.parse(request.responseText)
            if (typeof body.detail === 'string') detail = body.detail
          } catch { /* A proxy can return a non-JSON error. */ }
        }
        reject(new Error(detail))
      } else if (direct) {
        resolve({ id: target.id, status: 'processing', specimenId: null, error: null })
      } else {
        try {
          resolve(JSON.parse(request.responseText))
        } catch {
          reject(new Error('The upload server returned an unexpected response.'))
        }
      }
    }
    request.onerror = () => reject(new Error('The upload server could not be reached. Try again.'))
    request.ontimeout = () => reject(new Error('The upload timed out. Try again.'))
    request.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'))
    request.onloadend = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort)
    if (direct) {
      const body = new FormData()
      for (const [name, value] of Object.entries(target.fields)) body.append(name, value)
      body.append('file', file)
      request.send(body)
    } else {
      request.setRequestHeader('Content-Type', 'application/octet-stream')
      request.send(file)
    }
  })
}

export function UploadForm() {
  const [file, setFile] = useState<File>()
  const [progress, setProgress] = useState<number>()
  const [job, setJob] = useState<Job>()
  const [error, setError] = useState('')
  const submission = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const busy = progress !== undefined || job?.status === 'processing'

  useEffect(() => () => submission.current?.abort(), [])

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

  async function submit() {
    if (!file || busy || submission.current) return
    setError('')
    setJob(undefined)
    if (!/\.(stl|ply)$/i.test(file.name) || file.size === 0 || file.size > MAX_BYTES) {
      setError('Choose a nonempty STL or PLY file, up to 100 MB.')
      return
    }
    const controller = new AbortController()
    submission.current = controller
    setProgress(0)
    try {
      const body = JSON.stringify({ filename: file.name, size: file.size })
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // CloudFront needs the body hash when it signs a Lambda Function URL request.
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
        headers['x-amz-content-sha256'] = Array.from(new Uint8Array(digest),
          (byte) => byte.toString(16).padStart(2, '0')).join('')
      }
      const response = await fetch(apiUrl('/uploads/init'), {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Unable to start the upload.')
      }
      const target: UploadTarget = await response.json()
      const result = await sendMesh(file, target, controller.signal, setProgress)
      if (!controller.signal.aborted) setJob(result)
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'Unable to upload the mesh.')
      }
    } finally {
      submission.current = null
      if (!controller.signal.aborted) setProgress(undefined)
    }
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
