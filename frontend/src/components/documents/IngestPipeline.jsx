import { useEffect, useState } from 'react'
import { plural } from '../../lib/format'
import Icon from '../Icon'

// What happens to an uploaded PDF, in the order the backend does it.
const STEPS = [
  { icon: 'upload', title: 'Upload', text: 'The file is sent to the server.' },
  { icon: 'file', title: 'Read pages', text: 'Text is taken from every page. Scanned pictures have no text.' },
  { icon: 'layers', title: 'Split into chunks', text: 'About 800 characters each, overlapping so no sentence is cut.' },
  { icon: 'sparkle', title: 'Embed', text: 'Each chunk becomes a vector: numbers that capture its meaning.' },
  { icon: 'database', title: 'Store', text: 'Vectors go into Chroma, tagged with the document and page.' },
]

// What each step shows once the PDF is ready.
function resultFor(index, doc) {
  const results = ['Sent', plural(doc.pages, 'page'), plural(doc.chunks, 'chunk'), plural(doc.chunks, 'vector'), 'Saved in Chroma']
  return results[index]
}

// The state of one step: 'idle' | 'active' | 'waiting' | 'working' | 'done' | 'failed'.
// The backend reads, splits, embeds and stores in ONE request and does not say which step it is on,
// so while it works, steps 2-5 are all "working" together. They tick one by one when it answers.
function stepState(index, job) {
  if (!job) return 'idle'
  if (job.stage === 'uploading') return index === 0 ? 'active' : 'waiting'
  if (job.stage === 'processing') return index === 0 ? 'done' : 'working'
  if (job.stage === 'done') return 'done'
  if (index === 0) return job.progress >= 1 ? 'done' : 'failed' // error: did the file at least arrive?
  return 'idle'
}

// 2_400_000 -> "2.3 MB", 48_000 -> "47 KB"
function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Seconds since `startedAt`, ticking while `running` is true.
function useSecondsSince(startedAt, running) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
}

// The ingestion pipeline, live.
//   job = null: nothing uploaded yet, so the steps explain what will happen.
//   job = { file, stage: 'uploading' | 'processing' | 'done' | 'error', progress, doc, error, startedAt, finishedAt }
export default function IngestPipeline({ job, onReset }) {
  const busy = job?.stage === 'uploading' || job?.stage === 'processing'
  const seconds = useSecondsSince(job?.startedAt, busy)
  const percent = Math.round((job?.progress || 0) * 100)

  let heading = <h3>How a PDF is indexed</h3>
  if (job) {
    heading = (
      <div className="ingest-file">
        <span className={`ingest-badge ${job.stage}`}>
          {busy && <span className="spinner small" />}
          {job.stage === 'done' && <Icon name="check" size={14} />}
          {job.stage === 'error' && <Icon name="x" size={14} />}
        </span>
        <div className="ingest-file-text">
          <b title={job.file.name}>{job.file.name}</b>
          <span className="muted small">
            {fileSize(job.file.size)}
            {job.stage === 'uploading' && ` · uploading ${percent}%`}
            {job.stage === 'processing' && ` · reading, chunking and indexing · ${seconds}s`}
            {job.stage === 'done' && ` · ready in ${((job.finishedAt - job.startedAt) / 1000).toFixed(1)}s`}
            {job.stage === 'error' && ' · not indexed'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`ingest ${job ? job.stage : 'idle'}`}>
      {heading}

      <ol className="pipe">
        {STEPS.map((step, i) => {
          const state = stepState(i, job)
          return (
            <li key={step.title} className={`pipe-step ${state}`} style={{ '--i': i }}>
              <span className="pipe-icon">
                <Icon name={state === 'done' ? 'check' : step.icon} size={15} />
              </span>
              <div className="pipe-body">
                <div className="pipe-title">
                  {step.title}
                  {state === 'done' && job?.doc && <span className="pipe-result">{resultFor(i, job.doc)}</span>}
                </div>
                {state === 'active' ? (
                  <div className="pipe-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                ) : (
                  <div className="muted small">{step.text}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {job?.stage === 'error' && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={16} />
          <span>{job.error}</span>
        </div>
      )}

      {(job?.stage === 'done' || job?.stage === 'error') && (
        <div className="ingest-actions">
          {job.stage === 'done' && (
            <a className="button-link primary" href={`#/docs/${job.doc.id}`}>
              <Icon name="chat" size={15} />
              Ask questions
            </a>
          )}
          <button onClick={onReset}>
            <Icon name="upload" size={15} />
            {job.stage === 'done' ? 'Upload another' : 'Try another file'}
          </button>
        </div>
      )}
    </div>
  )
}
