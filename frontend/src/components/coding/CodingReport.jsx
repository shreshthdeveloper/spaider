import { useRef, useState } from 'react'
import { startCodingRound } from '../../lib/api'
import { scoreClass } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import ExportReport, { ExportBrand } from '../ExportReport'

const LEVEL_TEXT = { missing: 'Missing', basic: 'Basic', good: 'Good', strong: 'Strong' }

function verdict(overall) {
  if (overall >= 4) return 'Strong solution'
  if (overall >= 3) return 'Solid, with a few gaps'
  if (overall >= 1.5) return 'A start: important parts are missing'
  return 'Needs much more work'
}

// The end of a coding round: the score, the tests, each rubric area with the words that prove it,
// your final code and the best known approach. Correctness comes from the tests, not from the AI.
export default function CodingReport({ session }) {
  const reportRef = useRef(null) // the whole report, for the image and PDF export
  const [restarting, setRestarting] = useState(false)
  const report = session.report
  const practice = session.mode === 'practice'

  async function tryAgain() {
    setRestarting(true)
    try {
      const next = await startCodingRound({ problemId: session.problem.id, mode: session.mode })
      go(`coding/${next.id}`)
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className="page wb-report" ref={reportRef}>
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Coding report · {practice ? 'Practice' : 'Interview'} mode</div>
          <h1 className="topic-title">{session.problem.title}</h1>
          <p className="muted">{session.problem.statement}</p>
        </div>
        <div className="row no-export">
          <ExportReport target={reportRef} name={`${session.problem.title} coding report`} />
          <button onClick={tryAgain} disabled={restarting}>
            {restarting ? <span className="spinner small" /> : <Icon name="repeat" size={16} />}
            Try this problem again
          </button>
          <a className="button-link primary" href="#/coding">
            <Icon name="plus" size={16} />
            New coding round
          </a>
        </div>
      </header>

      <section className="card report-hero">
        <div className={`big-score ${scoreClass(report.overall)}`}>
          {report.overall}
          <span>/5</span>
        </div>
        <div className="report-body">
          <div className="report-verdict">{verdict(report.overall)}</div>
          <p className="report-summary">{report.summary}</p>
          <div className="report-facts">
            <span>
              <b>
                {report.tests.passed}/{report.tests.total}
              </b>{' '}
              tests passed
            </span>
            <span>
              <b>{report.hints_used}</b> hint{report.hints_used === 1 ? '' : 's'}
              {report.hint_cost > 0 && ` (−${report.hint_cost})`}
            </span>
            <span>
              Best approach: <b>{report.best}</b>
            </span>
          </div>
        </div>
      </section>

      <h2 className="section-title">Rubric</h2>
      <section className="card wb-rubric">
        {report.areas.map((area) => (
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
                {area.area === 'Correctness' ? area.evidence : `In your code or words: “${area.evidence}”`}
              </div>
            )}
            {area.unproven_claim && (
              <div className="wb-evidence unproven">
                <Icon name="x" size={13} />
                The AI quoted “{area.unproven_claim}”, but those words are not in your code or the conversation, so no
                points.
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

      <h2 className="section-title">Your final code</h2>
      <pre className="card code-snapshot">{session.code}</pre>

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
