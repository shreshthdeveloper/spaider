import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import ClaimDetail from '../components/resume/ClaimDetail'
import GrindCard from '../components/resume/GrindCard'
import ResumeLines from '../components/resume/ResumeLines'
import ResumeUpload from '../components/resume/ResumeUpload'
import SpiderLoader from '../components/SpiderLoader'
import { deleteResume, getResume, startResumeGrind, uploadResume } from '../lib/api'
import { go } from '../lib/router'

// #/resume: the Resume grind. First visit: upload. Then your resume as a heatmap (each claim coloured by how
// well you defend it), the grind card, and the claim you clicked. A grind opens as a normal mock interview.
export default function ResumePage() {
  const [resume, setResume] = useState(undefined) // undefined while loading, null before the first upload
  const [busy, setBusy] = useState('') // 'reading' (uploading) or 'starting' (a grind)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null) // the id of the claim open on the right
  const [confirmRemove, setConfirmRemove] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    getResume()
      .then((data) => setResume(data.resume))
      .catch((err) => {
        setError(err.message)
        setResume(null)
      })
  }, [])

  async function upload(input) {
    setBusy('reading')
    setError('')
    try {
      const data = await uploadResume(input)
      setResume(data.resume)
      setPicked(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function startGrind(settings) {
    setBusy('starting')
    setError('')
    try {
      const interview = await startResumeGrind(settings)
      go(`interview/${interview.id}`)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function remove() {
    setConfirmRemove(false)
    try {
      await deleteResume()
      setResume(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function pickNewVersion(e) {
    const file = e.target.files?.[0]
    if (file) upload({ file })
    e.target.value = ''
  }

  if (resume === undefined) {
    return (
      <div className="page resume-page">
        <SpiderLoader label="Loading your resume…" />
      </div>
    )
  }
  if (resume === null) return <ResumeUpload busy={busy === 'reading'} error={error} onUpload={upload} />

  const claim = resume.claims.find((c) => c.id === picked)
  const notOnLines = resume.claims.filter((c) => c.line === null)

  return (
    <div className="page resume-page">
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Resume grind</div>
          <h1>Your resume</h1>
          <div className="muted small">
            {resume.filename} · version {resume.version} · {resume.claims.length} claims
            {resume.removed_details > 0 && ` · ${resume.removed_details} contact details hidden from the AI`}
          </div>
        </div>
        <div className="row">
          <button onClick={() => fileRef.current.click()} disabled={Boolean(busy)} title="Unchanged lines keep their progress">
            {busy === 'reading' ? <span className="spinner small" /> : <Icon name="upload" size={16} />}
            {busy === 'reading' ? 'Reading it…' : 'Upload a new version'}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={pickNewVersion} />
          <button className="danger-outline" onClick={() => setConfirmRemove(true)} disabled={Boolean(busy)}>
            <Icon name="trash" size={16} />
            Remove
          </button>
        </div>
      </header>

      {error && (
        <div className="inline-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <News resume={resume} />

      <div className="resume-layout">
        <section className="card resume-paper">
          <ResumeLines lines={resume.lines} claims={resume.claims} picked={picked} onPick={setPicked} />
          {notOnLines.length > 0 && (
            <div className="resume-extra">
              <div className="field-label">Also found (couldn't be placed on a line)</div>
              {notOnLines.map((c) => (
                <button key={c.id} className={`resume-line claim-line starts level-${c.level}${picked === c.id ? ' picked' : ''}`} onClick={() => setPicked(c.id)}>
                  <span className="claim-text">{c.quote}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="resume-side">
          <GrindCard resume={resume} busy={busy === 'starting'} onStart={startGrind} />
          {claim ? (
            <ClaimDetail key={claim.id} claim={claim} />
          ) : (
            <section className="card claim-hint muted">
              <Icon name="eye" size={18} />
              Click a coloured line to see what they'll ask about it, and every answer you gave.
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        icon="trash"
        title="Remove your resume?"
        text="Its claims and their progress are deleted. Your grind interviews stay in Past interviews."
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}

// What changed since you last looked: the new version's differences, and how the last grind went.
function News({ resume }) {
  const changes = resume.changes || {}
  const last = resume.last_grind || {}
  const removed = changes.removed || []
  const showChanges = resume.version > 1 && (changes.new > 0 || changes.changed > 0 || removed.length > 0)
  if (!showChanges && !last.asked) return null

  return (
    <div className="resume-news">
      {showChanges && (
        <div className="news-item">
          <Icon name="upload" size={15} />
          <span>
            <b>Version {resume.version}:</b> {changes.new} new, {changes.changed} changed (asked first), {removed.length} removed.
          </span>
          {removed.length > 0 && <span className="muted small news-removed">Removed: {removed.join(' · ')}</span>}
        </div>
      )}
      {last.asked > 0 && (
        <div className="news-item">
          <Icon name="flame" size={15} />
          <span>
            <b>Last grind:</b> {last.asked} lines asked
            {last.better > 0 && ` · ${last.better} better`}
            {last.worse > 0 && ` · ${last.worse} worse`}
            {last.same > 0 && ` · ${last.same} the same`}
            {last.first > 0 && ` · ${last.first} asked for the first time`}
          </span>
        </div>
      )}
    </div>
  )
}
