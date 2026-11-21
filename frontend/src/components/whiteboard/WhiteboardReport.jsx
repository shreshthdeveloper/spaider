import { useRef, useState } from 'react'
import { startWhiteboard } from '../../lib/api'
import { scoreClass } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import ExportReport, { ExportBrand } from '../ExportReport'

const LEVEL_TEXT = { missing: 'Missing', basic: 'Basic', good: 'Good', strong: 'Strong' }

function verdict(overall) {
  if (overall >= 4) return 'Strong design'
  if (overall >= 3) return 'Solid, with a few gaps'
  if (overall >= 1.5) return 'A start: key parts are missing'
  return 'Needs much more work'
}

// The end of a whiteboard round: the score, your final board, each rubric area with the words that
// prove it, and what to study next. Points come from the code, not from a number the AI picked.
export default function WhiteboardReport({ session }) {
  const reportRef = useRef(null) // the whole report, for the image and PDF export
  const [restarting, setRestarting] = useState(false)
  const report = session.report
  const areas = report.areas || []

  async function tryAgain() {
    setRestarting(true)
    try {
      const next = await startWhiteboard({ question: session.question, brief: session.brief })
      go(`whiteboard/${next.id}`)
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className="page wb-report" ref={reportRef}>
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Whiteboard report</div>
          <h1 className="topic-title">{session.question}</h1>
          <p className="muted">{session.brief}</p>
        </div>
        <div className="row no-export">
          <ExportReport target={reportRef} name={`${session.question} design report`} />
          <button onClick={tryAgain} disabled={restarting}>
            {restarting ? <span className="spinner small" /> : <Icon name="repeat" size={16} />}
            Try this question again
          </button>
          <a className="button-link primary" href="#/whiteboard">
            <Icon name="plus" size={16} />
            New whiteboard
          </a>
        </div>
      </header>

      <div className="wb-report-top">
        <section className="card report-hero">
          <div className={`big-score ${scoreClass(report.overall)}`}>
            {report.overall}
            <span>/5</span>
          </div>
          <div className="report-body">
            <div className="report-verdict">{verdict(report.overall)}</div>
            <p className="report-summary">{report.summary}</p>
          </div>
        </section>

        {session.final_image && (
          <section className="card wb-snapshot">
            <img src={session.final_image} alt="Your final board" />
          </section>
        )}
      </div>

      <h2 className="section-title">Rubric</h2>
      <section className="card wb-rubric">
        {areas.map((area) => (
          <div key={area.area} className="wb-area">
            <div className="wb-area-head">
              <b>{area.area}</b>
              <span className={`level level-${area.level}`}>{LEVEL_TEXT[area.level]}</span>
              <span className="wb-points">{area.points}/5</span>
            </div>
            <div className="muted small">Looks for: {area.looks_for}</div>
            <p className="wb-comment">{area.comment}</p>
            {area.evidence && (
              <div className="wb-evidence">
                <Icon name="check" size={13} />
                On your board: “{area.evidence}”
              </div>
            )}
            {area.unproven_claim && (
              <div className="wb-evidence unproven">
                <Icon name="x" size={13} />
                The AI quoted “{area.unproven_claim}”, but those words are not on your board or in the conversation, so
                no points.
              </div>
            )}
          </div>
        ))}
      </section>

      {(report.strengths.length > 0 || report.improve.length > 0) && (
        <div className="report-lists">
          {report.strengths.length > 0 && (
            <section className="card">
              <h3>What went well</h3>
              <ul className="dot-list good">
                {report.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {report.improve.length > 0 && (
            <section className="card">
              <h3>Study next</h3>
              <ul className="dot-list warn">
                {report.improve.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <h2 className="section-title">Conversation</h2>
      <section className="card wb-transcript">
        {session.messages.map((message, i) => {
          const bella = message.role === 'interviewer'
          return (
            <div key={i} className={`wb-msg ${bella ? 'bella' : 'you'}`}>
              {bella && <span className="wb-face">B</span>}
              <div className="wb-bubble">{message.text}</div>
            </div>
          )
        })}
      </section>
      <ExportBrand />
    </div>
  )
}
