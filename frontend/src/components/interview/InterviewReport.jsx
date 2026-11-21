import { useRef, useState } from 'react'
import { startInterview } from '../../lib/api'
import { scoreClass } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import ExportReport, { ExportBrand } from '../ExportReport'
import InterviewXray from './InterviewXray'

function verdict(overall, answeredAny) {
  if (!answeredAny) return 'No answers given'
  if (overall >= 4) return 'Strong performance'
  if (overall >= 3) return 'Solid, with a few gaps'
  return 'Needs more practice'
}

// Screen 3: the final report, then every answer with what it covered and missed.
export default function InterviewReport({ interview }) {
  const reportRef = useRef(null) // the whole report, for the image and PDF export
  const [restarting, setRestarting] = useState(false)
  const [xrayOpen, setXrayOpen] = useState(false)
  const report = interview.report || {}
  const strengths = report.strengths || []
  const improve = report.improve || []
  const results = interview.results

  // Simple counts for the header: main questions, follow-ups, and key points covered.
  let mainAnswers = 0
  let followUps = 0
  let pointsCovered = 0
  let pointsTotal = 0
  for (const r of results) {
    if (r.is_follow_up) {
      followUps += 1
    } else {
      mainAnswers += 1
      pointsCovered += r.covered.length
      pointsTotal += r.covered.length + r.missed.length
    }
  }

  async function practiceAgain() {
    setRestarting(true)
    try {
      const next = await startInterview({
        topic: interview.topic,
        numQuestions: interview.num_questions,
        difficulty: interview.difficulty,
        followUps: interview.max_follow_ups,
        mode: interview.mode,
      })
      go(`interview/${next.id}`)
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className="page interview-page" ref={reportRef}>
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Interview report</div>
          <h1 className="topic-title">{interview.topic}</h1>
        </div>
        <div className="row no-export">
          <ExportReport target={reportRef} name={`${interview.topic.split('\n')[0]} interview report`} />
          <button onClick={() => setXrayOpen(true)} title="See every step the AI took, and why">
            <Icon name="eye" size={16} />
            X-ray
          </button>
          <button onClick={practiceAgain} disabled={restarting}>
            {restarting ? <span className="spinner small" /> : <Icon name="repeat" size={16} />}
            Practice this topic again
          </button>
          <a className="button-link primary" href="#/interview">
            <Icon name="plus" size={16} />
            New interview
          </a>
        </div>
      </header>

      <section className="card report-hero">
        <div className={`big-score ${scoreClass(report.overall)}`}>
          {report.overall ?? 0}
          <span>/5</span>
        </div>
        <div className="report-body">
          <div className="report-verdict">{verdict(report.overall, results.length > 0)}</div>
          <p className="report-summary">{report.summary}</p>
          {results.length > 0 && (
            <div className="report-facts">
              <span>
                <b>{mainAnswers}</b> of {interview.num_questions} questions answered
              </span>
              <span>
                <b>{followUps}</b> follow-up{followUps === 1 ? '' : 's'}
              </span>
              <span>
                {interview.difficulty === 'mixed' ? 'Mixed difficulty' : `${interview.difficulty} difficulty`} ·{' '}
                {interview.mode === 'voice' ? 'voice' : 'text'}
              </span>
              <span>
                <b>
                  {pointsCovered}/{pointsTotal}
                </b>{' '}
                key points covered
              </span>
            </div>
          )}
        </div>
      </section>

      {(strengths.length > 0 || improve.length > 0) && (
        <div className="report-lists">
          {strengths.length > 0 && (
            <section className="card">
              <h3>What went well</h3>
              <ul className="dot-list good">
                {strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {improve.length > 0 && (
            <section className="card">
              <h3>Study next</h3>
              <ul className="dot-list warn">
                {improve.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <h2 className="section-title">Your answers</h2>
      {results.length === 0 && <p className="muted">No answers were given.</p>}

      {results.map((r, i) => (
        <section key={i} className={`card result-card${r.is_follow_up ? ' follow' : ''}`}>
          <div className="result-head">
            <span className={`chip${r.is_follow_up ? ' chip-follow' : ''}`}>{r.is_follow_up ? 'Follow-up' : 'Question'}</span>
            <span className={`badge ${scoreClass(r.score)}`}>{r.score}/5</span>
          </div>
          <p className="result-question">{r.question}</p>
          <div className="your-answer">{r.answer}</div>
          {(r.covered.length > 0 || r.missed.length > 0) && (
            <ul className="point-list">
              {r.covered.map((p) => (
                <li key={`c-${p}`} className="hit">
                  <Icon name="check" size={15} />
                  {p}
                </li>
              ))}
              {r.missed.map((p) => (
                <li key={`m-${p}`} className="miss">
                  <Icon name="x" size={15} />
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="result-feedback muted">{r.feedback}</p>
        </section>
      ))}
      <ExportBrand />
      <InterviewXray interviewId={interview.id} open={xrayOpen} onClose={() => setXrayOpen(false)} />
    </div>
  )
}
