import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import DocumentChat from '../components/documents/DocumentChat'
import IngestPipeline from '../components/documents/IngestPipeline'
import UploadBox from '../components/documents/UploadBox'
import Icon from '../components/Icon'
import { deleteDocument, listDocuments, uploadDocument } from '../lib/api'
import { formatDate, plural } from '../lib/format'

const MAX_SIZE = 10 * 1024 * 1024 // must match MAX_CONTENT_LENGTH in the backend

// #/docs        -> upload PDFs and manage your library
// #/docs/<id>   -> ask questions about one document
export default function DocumentsPage({ arg }) {
  if (arg) {
    return (
      <div className="page docs-page">
        <DocumentChat id={arg} />
      </div>
    )
  }
  return <DocumentLibrary />
}

// Upload at the top (with the live pipeline), your documents below.
function DocumentLibrary() {
  const [documents, setDocuments] = useState(null) // null = still loading
  const [job, setJob] = useState(null) // the upload in progress or just finished (see IngestPipeline)
  const [fileOver, setFileOver] = useState(false) // a file is being dragged over the page
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState(null) // the document waiting for "Delete?" to be confirmed
  const [deleteError, setDeleteError] = useState('')
  const uploadRef = useRef(null) // the latest upload(), for the page-wide drop handler

  const busy = job?.stage === 'uploading' || job?.stage === 'processing'

  function refresh() {
    listDocuments()
      .then((data) => setDocuments(data.documents))
      .catch(() => setDocuments([]))
  }

  useEffect(() => {
    refresh()
  }, [])

  async function upload(file) {
    if (busy) return
    const start = { file, progress: 0, startedAt: Date.now() }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setJob({ ...start, stage: 'error', error: 'Only PDF files are supported.' })
      return
    }
    if (file.size > MAX_SIZE) {
      setJob({ ...start, stage: 'error', error: 'This file is too large (max 10 MB).' })
      return
    }

    setJob({ ...start, stage: 'uploading' })
    function onProgress(fraction) {
      setJob((current) => ({ ...current, progress: fraction, stage: fraction >= 1 ? 'processing' : 'uploading' }))
    }
    try {
      const doc = await uploadDocument(file, onProgress)
      setJob((current) => ({ ...current, stage: 'done', doc, finishedAt: Date.now() }))
      refresh()
    } catch (err) {
      setJob((current) => ({ ...current, stage: 'error', error: err.message }))
    }
  }

  useEffect(() => {
    uploadRef.current = upload
  })

  // Drop a PDF anywhere on the page. Without this, a file dropped outside the box would make the
  // browser leave the app and open the PDF.
  useEffect(() => {
    let depth = 0 // dragenter and dragleave fire for every element under the mouse, so count them
    const hasFiles = (e) => e.dataTransfer?.types.includes('Files')

    function onEnter(e) {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setFileOver(true)
    }
    function onOver(e) {
      if (hasFiles(e)) e.preventDefault() // this is what allows the drop
    }
    function onLeave(e) {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setFileOver(false)
    }
    function onDrop(e) {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setFileOver(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadRef.current(file)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  async function remove() {
    const doc = toDelete
    setToDelete(null)
    setDeleteError('')
    try {
      await deleteDocument(doc.id)
      refresh()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  const words = search.trim().toLowerCase()
  const shown = (documents || []).filter((doc) => !words || doc.filename.toLowerCase().includes(words))
  const newId = job?.stage === 'done' ? job.doc.id : null

  return (
    <div className="page docs-page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Study material</div>
          <h1>Documents</h1>
          <p className="muted">Upload a PDF and it is indexed for questions, so answers can point to the page.</p>
        </div>
      </header>

      <section className="card ingest-card">
        <UploadBox onFile={upload} busy={busy} dragging={fileOver && !busy} />
        <IngestPipeline job={job} onReset={() => setJob(null)} />
      </section>

      <section className="library">
        <div className="library-head">
          <h2>
            Your documents
            {documents && documents.length > 0 && <span className="tab-count">{documents.length}</span>}
          </h2>
          {documents && documents.length > 0 && (
            <label className="search-box">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
              />
            </label>
          )}
        </div>

        {deleteError && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={16} />
            <span>{deleteError}</span>
          </div>
        )}

        {documents === null && (
          <div className="doc-grid">
            {[0, 1, 2].map((n) => (
              <div key={n} className="doc-card skeleton" />
            ))}
          </div>
        )}

        {documents && documents.length === 0 && (
          <div className="library-empty">
            <Icon name="file" size={22} />
            <p>No documents yet. Upload a PDF above, then ask it questions.</p>
          </div>
        )}

        {documents && documents.length > 0 && shown.length === 0 && <p className="muted">No documents match.</p>}

        {shown.length > 0 && (
          <div className="doc-grid">
            {shown.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} isNew={doc.id === newId} onDelete={setToDelete} />
            ))}
          </div>
        )}
      </section>

      {fileOver && !busy && (
        <div className="drop-overlay">
          <div className="drop-overlay-box">
            <Icon name="upload" size={30} />
            Drop your PDF to upload
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        icon="trash"
        title="Delete this document?"
        text={`${toDelete?.filename ?? ''} and its chunks will be removed from the search index. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function DocumentCard({ doc, index, isNew, onDelete }) {
  return (
    <article className={`doc-card${isNew ? ' new' : ''}`} style={{ '--i': index }}>
      <div className="doc-card-top">
        <span className="doc-thumb">
          <Icon name="file" size={18} />
          <b>PDF</b>
        </span>
        {isNew && <span className="badge score-good">New</span>}
        <button
          className="icon-btn"
          onClick={() => onDelete(doc)}
          title={`Delete ${doc.filename}`}
          aria-label={`Delete ${doc.filename}`}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <h3 className="doc-name" title={doc.filename}>
        {doc.filename}
      </h3>
      <div className="doc-meta muted small">
        <span>
          <Icon name="file" size={13} /> {plural(doc.pages, 'page')}
        </span>
        <span>
          <Icon name="layers" size={13} /> {plural(doc.chunks, 'chunk')}
        </span>
      </div>
      <div className="doc-foot">
        <span className="muted small">{formatDate(doc.created_at)}</span>
        <a className="doc-ask" href={`#/docs/${doc.id}`}>
          Ask questions
          <Icon name="chevron" size={14} />
        </a>
      </div>
    </article>
  )
}
