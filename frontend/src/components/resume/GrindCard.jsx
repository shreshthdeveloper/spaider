import { useState } from 'react'
import Icon from '../Icon'
import { LEVEL_ORDER, LEVELS } from './levels'

const SIZES = [3, 5, 8] // lines per grind (the backend allows these)

// How ready your resume is, and the button that starts a grind.
//   resume   the resume from the backend (counts, ready, due, open_grind)
//   busy     true while a grind is starting
//   onStart  ({ count, mode })
export default function GrindCard({ resume, busy, onStart }) {
  const [count, setCount] = useState(5)
  const [mode, setMode] = useState('text')

  return (
    <section className="card grind-card">
      <div className="grind-top">
        <div className="grind-ready">
          <b>{resume.ready}%</b>
          <span className="muted small">of your lines defended</span>
        </div>
        <span className={`chip${resume.due > 0 ? ' due-chip' : ''}`}>
          <Icon name="clock" size={13} />
          {resume.due} due today
        </span>
      </div>

      <div className="grind-bar" aria-hidden="true">
        {LEVEL_ORDER.map((level) =>
          resume.counts[level] > 0 ? (
            <span key={level} className={`level-${level}`} style={{ flexGrow: resume.counts[level] }} />
          ) : null,
        )}
      </div>
      <div className="grind-legend small">
        {LEVEL_ORDER.map((level) => (
          <span key={level}>
            <i className={`level-${level}`} />
            {resume.counts[level]} {LEVELS[level].short}
          </span>
        ))}
      </div>

      {resume.open_grind && (
        <a className="button-link grind-continue" href={`#/interview/${resume.open_grind}`}>
          <Icon name="play" size={15} />
          Continue your unfinished grind
        </a>
      )}

      <div className="grind-options">
        <div className="grind-option">
          <span className="field-label">Lines (up to)</span>
          <div className="row">
            {SIZES.map((size) => (
              <button key={size} className={`chip-btn${count === size ? ' on' : ''}`} onClick={() => setCount(size)}>
                {size}
              </button>
            ))}
          </div>
        </div>
        <div className="grind-option">
          <span className="field-label">Answer by</span>
          <div className="row">
            <button className={`chip-btn${mode === 'text' ? ' on' : ''}`} onClick={() => setMode('text')}>
              <Icon name="keyboard" size={14} />
              Typing
            </button>
            <button className={`chip-btn${mode === 'voice' ? ' on' : ''}`} onClick={() => setMode('voice')}>
              <Icon name="mic" size={14} />
              Voice call
            </button>
          </div>
        </div>
      </div>

      <button className="primary grind-start" onClick={() => onStart({ count, mode })} disabled={busy}>
        {busy ? <span className="spinner small" /> : <Icon name="flame" size={16} />}
        {busy ? 'Bella is reading your weak lines…' : 'Start a grind'}
      </button>
      <p className="muted small grind-note">
        Bella asks one "prove it" question per line, weakest first, with a follow-up if you're vague. Red lines come back
        tomorrow, yellow in 3 days, green in a week.
      </p>
    </section>
  )
}
