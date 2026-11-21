import { useEffect, useState } from 'react'
import { getEval } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { ScoreChips } from '../bank/ReviewPanel'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import { meetsTarget, METRICS, showMetric, showTarget } from './metrics'

const SUITE_NAMES = { grader: 'Interview grader', judge: 'Question bank judge' }

// #/evals/<id>: one run, case by case: what you expected, what the AI did, and where they differ.
export default function EvalRun({ id }) {
  const [run, setRun] = useState(null)
  const [error, setError] = useState('')
  const [onlyFailed, setOnlyFailed] = useState(false)

  useEffect(() => {
    getEval(id)
      .then(setRun)
      .catch((err) => setError(err.message))
  }, [id])

  if (!run) {
    return (
      <div className="page evals-page">
        {error ? <p className="inline-error">{error}</p> : <SpiderLoader label="Loading the run…" />}
      </div>
    )
  }

  const metrics = METRICS[run.suite] || []
  const failed = run.cases.filter((c) => !c.passed)
  const shown = onlyFailed ? failed : run.cases

  return (
    <div className="page evals-page">
      <header className="page-head">
        <div>
          <a className="eval-back" href="#/evals">
            <Icon name="back" size={14} />
            All evals
          </a>
          <h1>{SUITE_NAMES[run.suite] || run.suite}</h1>
          <p className="muted small">
            {formatDate(run.created_at)} · model <code>{run.model}</code> · prompt <code>{run.prompt_version}</code>
            {run.duration_ms ? ` · ${(run.duration_ms / 1000).toFixed(1)} s` : ''}
          </p>
        </div>
      </header>

      {run.status === 'failed' && <p className="inline-error">This run failed: {run.error}</p>}
      {run.status === 'running' && <SpiderLoader label="Still running…" />}

      <div className="metric-tiles wide">
        {metrics.map((metric) => {
          const value = run.metrics?.[metric.id]
          return (
            <div key={metric.id} className={`metric-tile ${meetsTarget(metric, value) ? 'good' : 'short'}`}>
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{showMetric(metric, value)}</span>
              <span className="metric-target">{showTarget(metric)}</span>
              <span className="metric-help">{metric.help}</span>
            </div>
          )
        })}
      </div>

      {run.metrics?.summary && (
        <p className="eval-summary">
          <b>Judge said:</b> {run.metrics.summary}
        </p>
      )}

      <div className="eval-filter">
        <span className="muted">
          {run.cases.length - failed.length} of {run.cases.length} cases match your answer key
        </span>
        <div className="chips-row">
          <button type="button" className={`chip-btn${onlyFailed ? '' : ' on'}`} onClick={() => setOnlyFailed(false)}>
            All · {run.cases.length}
          </button>
          <button type="button" className={`chip-btn${onlyFailed ? ' on' : ''}`} onClick={() => setOnlyFailed(true)}>
            Mismatches · {failed.length}
          </button>
        </div>
      </div>

      <div className="eval-cases">
        {shown.map((c) =>
          run.suite === 'grader' ? <GraderCase key={c.id} result={c} /> : <JudgeCase key={c.id} result={c} />,
        )}
      </div>
    </div>
  )
}

// One answer: each key point with your label and the grader's call side by side.
function GraderCase({ result }) {
  return (
    <section className={`card eval-case${result.passed ? '' : ' mismatch'}`}>
      <div className="eval-case-head">
        <span className={`badge ${result.passed ? 'score-good' : 'score-bad'}`}>{result.passed ? 'Match' : 'Mismatch'}</span>
        <span className="q-type">{result.kind.replace('_', ' ')}</span>
        <span className="muted small">{result.id}</span>
        <span className="eval-scores">
          score: you <b>{result.expected_score}</b> · grader <b>{result.got_score ?? '–'}</b>
        </span>
      </div>
      <p className="eval-question">{result.question}</p>
      <blockquote className="eval-answer">{result.answer}</blockquote>

      {result.error ? (
        <p className="inline-error">{result.error}</p>
      ) : (
        <table className="eval-points">
          <thead>
            <tr>
              <th>Key point</th>
              <th>You</th>
              <th>Grader</th>
            </tr>
          </thead>
          <tbody>
            {result.key_points.map((point, i) => {
              const expected = result.expected[i]
              const got = result.got[i]
              let mismatch = ''
              if (got && !expected) mismatch = 'too-generous'
              if (!got && expected) mismatch = 'too-harsh'
              return (
                <tr key={point} className={mismatch}>
                  <td>{point}</td>
                  <td>
                    <Mark covered={expected} />
                  </td>
                  <td>
                    <Mark covered={got} />
                    {mismatch === 'too-generous' && <span className="mismatch-why">free credit</span>}
                    {mismatch === 'too-harsh' && <span className="mismatch-why">missed</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {result.note && (
        <p className="muted small">
          <b>Why your label:</b> {result.note}
        </p>
      )}
      {result.feedback && (
        <p className="muted small">
          <b>Grader's feedback:</b> {result.feedback}
        </p>
      )}
    </section>
  )
}

function Mark({ covered }) {
  return (
    <span className={`point-mark ${covered ? 'yes' : 'no'}`} aria-label={covered ? 'covered' : 'not covered'}>
      <Icon name={covered ? 'check' : 'x'} size={13} />
    </span>
  )
}

// One question: should it be dropped (planted bad) and did the judge drop it?
function JudgeCase({ result }) {
  return (
    <section className={`card eval-case${result.passed ? '' : ' mismatch'}`}>
      <div className="eval-case-head">
        <span className={`badge ${result.passed ? 'score-good' : 'score-bad'}`}>{result.passed ? 'Match' : 'Mismatch'}</span>
        <span className="q-type">{result.kind.replace('_', ' ')}</span>
        <span className="muted small">{result.id}</span>
        <span className="eval-scores">
          expected <b>{result.expected_drop ? 'drop' : 'keep'}</b> · judge <b>{result.got_drop ? 'drop' : 'keep'}</b>
        </span>
      </div>
      <p className="eval-question">{result.question}</p>
      {result.reason && <p className="muted small">Judge's reason: {result.reason}</p>}
      <ScoreChips scores={result.scores} />
    </section>
  )
}
