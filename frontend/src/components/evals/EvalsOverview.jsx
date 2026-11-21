import { useEffect, useState } from 'react'
import { listEvals, runEval } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import { meetsTarget, METRICS, showMetric, showTarget } from './metrics'

const POLL_MS = 1500 // while a suite runs, check on it this often
const HISTORY = 6 // past runs shown on each suite card

const SUITE_ICONS = { grader: 'target', judge: 'eye' }

// #/evals: each suite with its latest scores, its recent history, and a button to run it again.
export default function EvalsOverview() {
  const [data, setData] = useState(null) // { suites, runs }
  const [error, setError] = useState('')
  const [polls, setPolls] = useState(0) // starting a run bumps this, which restarts the polling

  useEffect(() => {
    let alive = true
    let timer = null
    function load() {
      listEvals()
        .then((result) => {
          if (!alive) return
          setData(result)
          setError('')
          const running = result.runs.some((run) => run.status === 'running')
          if (running) timer = setTimeout(load, POLL_MS)
        })
        .catch((err) => alive && setError(err.message))
    }
    load()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [polls])

  async function start(suite) {
    try {
      await runEval(suite)
      setPolls((n) => n + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page evals-page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Insights</div>
          <h1>Evals</h1>
          <p className="muted">
            Tests for the AI: fixed examples with answers you agree with. Run them after every prompt change, and
            the numbers say whether it got better or worse.
          </p>
        </div>
      </header>

      {error && <p className="inline-error">{error}</p>}
      {!data && !error && <SpiderLoader label="Loading the evals…" />}

      {data && (
        <>
          <div className="suite-cards">
            {data.suites.map((suite) => (
              <SuiteCard
                key={suite.id}
                suite={suite}
                runs={data.runs.filter((run) => run.suite === suite.id)}
                onRun={() => start(suite.id)}
              />
            ))}
          </div>

          <section className="card eval-how">
            <h2>How an eval works</h2>
            <ol className="eval-steps">
              <li>
                <b>An answer key.</b> Cases with the right answer, labelled by you, in{' '}
                <code>backend/evals/cases/</code>.
              </li>
              <li>
                <b>Run the real AI step</b> (the same grader or judge the app uses) on every case.
              </li>
              <li>
                <b>Compare</b> what it did with your labels, and count: agreement, precision, recall.
              </li>
              <li>
                <b>Change a prompt, run again.</b> The prompt fingerprint (like <code>8a4478a</code>) shows which
                prompt got which score.
              </li>
            </ol>
            <p className="muted small">
              From the terminal: <code>python -m evals.run grader</code> (or <code>judge</code>), inside{' '}
              <code>backend/</code>. Runs from there show up here too.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function SuiteCard({ suite, runs, onRun }) {
  const running = runs.find((run) => run.status === 'running')
  const finished = runs.filter((run) => run.status !== 'running')
  const latest = finished[0]
  const metrics = METRICS[suite.id] || []

  return (
    <section className="card suite-card">
      <div className="suite-head">
        <span className="suite-icon">
          <Icon name={SUITE_ICONS[suite.id] || 'check'} size={18} />
        </span>
        <div className="suite-title">
          <h2>{suite.name}</h2>
          <p className="muted small">{suite.tests}</p>
        </div>
      </div>

      <div className="suite-facts muted small">
        {suite.cases} cases · {suite.ai_calls} AI {suite.ai_calls === 1 ? 'call' : 'calls'} per run · prompt{' '}
        <code>{suite.prompt_version}</code>
      </div>

      {latest && latest.status === 'failed' && <p className="inline-error">The last run failed: {latest.error}</p>}

      <div className="metric-tiles">
        {metrics.map((metric) => {
          const value = latest?.metrics?.[metric.id]
          const good = meetsTarget(metric, value)
          return (
            <div key={metric.id} className={`metric-tile${latest ? (good ? ' good' : ' short') : ''}`} title={metric.help}>
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{showMetric(metric, value)}</span>
              <span className="metric-target">{showTarget(metric)}</span>
            </div>
          )
        })}
      </div>

      {finished.length > 0 && (
        <div className="suite-history">
          <span className="muted small">Recent runs</span>
          <div className="history-chips">
            {finished.slice(0, HISTORY).map((run) => (
              <a key={run.id} className={`history-chip ${run.status}`} href={`#/evals/${run.id}`} title={`Model ${run.model}`}>
                <span>{formatDate(run.created_at)}</span>
                <b>{showMetric(metrics[0], run.metrics?.[metrics[0].id])}</b>
                <code>{run.prompt_version}</code>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="suite-actions">
        {latest && (
          <a className="button-link" href={`#/evals/${latest.id}`}>
            See every case
            <Icon name="chevron" size={14} />
          </a>
        )}
        <button className="primary" onClick={onRun} disabled={Boolean(running)}>
          {running ? (
            <>
              <span className="spinner small" />
              Running…
            </>
          ) : (
            <>
              <Icon name="play" size={15} />
              Run now
            </>
          )}
        </button>
      </div>
    </section>
  )
}
