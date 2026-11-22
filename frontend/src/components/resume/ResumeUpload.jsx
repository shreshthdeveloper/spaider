import { useRef, useState } from 'react'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'

const MIN_TEXT = 200 // the backend refuses anything shorter

const STEPS = [
  { icon: 'eye', text: 'Your email, phone number and links are taken out before the AI reads it.' },
  { icon: 'search', text: 'The AI lists every claim in it, word for word.' },
  { icon: 'mic', text: 'Bella asks you to prove each one. Lines turn green, yellow or red.' },
  { icon: 'repeat', text: 'Weak lines keep coming back. Update your resume any time: unchanged lines keep their progress.' },
]

// The first visit: drop the resume PDF here, or paste its text.
//   busy      true while the backend reads it
//   error     the last upload's error, if any
//   onUpload  ({ file }) or ({ text })
export default function ResumeUpload({ busy, error, onUpload }) {
  const fileRef = useRef(null)
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)

  function pick(e) {
    const file = e.target.files?.[0]
    if (file) onUpload({ file })
    e.target.value = '' // so picking the same file again still counts
  }

  function drop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && !busy) onUpload({ file })
  }

  return (
    <div className="page resume-page">
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Resume grind</div>
          <h1>Can you defend every line of your resume?</h1>
          <div className="muted">Upload it. Bella finds every claim and asks you to prove each one, until every line is green.</div>
        </div>
      </header>

      <section className="card resume-upload">
        {busy ? (
          <SpiderLoader size="large" label="Reading your resume and finding every claim…" />
        ) : (
          <>
            <div
              className={`drop-zone${dragging ? ' dragging' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
            >
              <span className="drop-icon">
                <Icon name="upload" size={24} />
              </span>
              <span className="drop-title">Drop your resume PDF here</span>
              <span className="muted small">or click to choose it</span>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
            </div>

            <div className="resume-paste">
              <label className="field-label" htmlFor="resume-text">
                Or paste the text
              </label>
              <textarea
                id="resume-text"
                rows={7}
                maxLength={20000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your whole resume here…"
              />
              <button className="primary" onClick={() => onUpload({ text })} disabled={text.trim().length < MIN_TEXT}>
                Use this text
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="inline-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <ol className="resume-steps">
          {STEPS.map((step) => (
            <li key={step.text}>
              <span className="resume-step-icon">
                <Icon name={step.icon} size={15} />
              </span>
              {step.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
