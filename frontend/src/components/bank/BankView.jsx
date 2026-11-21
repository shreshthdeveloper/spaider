import { useEffect, useState } from 'react'
import { getBank, retryBank } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import AgentInspector from './AgentInspector'
import AgentPipeline from './AgentPipeline'
import BankQuestions from './BankQuestions'
import BankTabs from './BankTabs'
import ReviewPanel from './ReviewPanel'
import RunTimeline from './RunTimeline'

const POLL_MS = 900 // while the panel works, ask for its progress this often

// #/bank/<id>: the panel at work (live), your turn in review mode, then the questions it wrote.
export default function BankView({ id }) {
  const [bank, setBank] = useState(null)
  const [error, setError] = useState('')
  const [polls, setPolls] = useState(0) // bumping this starts the polling again (after "Run again" or your review)
  const [inspecting, setInspecting] = useState(null) // the id of the card open in the side panel

  useEffect(() => {
    let alive = true
    let timer = null

    function load() {
      getBank(id)
        .then((data) => {
          if (!alive) return
          setBank(data)
          setError('')
          if (data.status === 'running') timer = setTimeout(load, POLL_MS) // stop when done, failed or waiting for you
        })
        .catch((err) => {
          if (!alive) return
          if (err.status === 404) {
            setError('This question bank was not found. It may have been deleted.')
          } else {
            setError(err.message)
            timer = setTimeout(load, POLL_MS * 3) // the backend may be back soon
          }
        })
    }

    load()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [id, polls])

  function carryOn(updated) {
    setBank(updated)
    setPolls((n) => n + 1)
  }

  async function runAgain() {
    try {
      carryOn(await retryBank(id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!bank) {
    return (
      <div className="page interview-page bank-page">
        <BankTabs current="" />
        {error ? <p className="inline-error">{error}</p> : <SpiderLoader label="Opening the bank…" />}
      </div>
    )
  }

  const { inputs } = bank
  const timing = bank.status === 'done' ? timingOf(bank.steps) : null

  return (
    <div className="page interview-page bank-page">
      <BankTabs current="" />

      <section className="card bank-head">
        <div className="bank-head-text">
          <h2>{bank.title}</h2>
          <div className="bank-facts">
            <span className="chip">{inputs.level}</span>
            <span className="chip">{inputs.interview_type}</span>
            {inputs.has_jd && <span className="chip">JD</span>}
            {inputs.has_resume && <span className="chip">Resume</span>}
            {inputs.topics && <span className="chip">{inputs.topics}</span>}
            {inputs.documents.map((doc) => (
              <span key={doc.id} className="chip">
                <Icon name="file" size={12} />
                {doc.filename}
              </span>
            ))}
            {bank.review && <span className="chip review-chip">Review mode</span>}
            <span className="muted small">{formatDate(bank.created_at)}</span>
          </div>
        </div>
        {bank.status === 'running' && (
          <span className="badge badge-progress">
            <span className="live-dot" />
            The panel is working
          </span>
        )}
        {bank.status === 'needs_you' && <span className="badge review-badge">Waiting for you</span>}
        {(bank.status === 'done' || bank.status === 'failed') && (
          <button className="small" onClick={runAgain}>
            <Icon name="repeat" size={14} />
            Run the panel again
          </button>
        )}
      </section>

      <section className="card pipeline-card">
        <AgentPipeline steps={bank.steps} onInspect={(step) => setInspecting(step.id)} />
        <p className="muted small pipeline-foot">
          {timing
            ? `Done in ${timing.total} s${timing.waited ? ` (${timing.waited} s of it waiting for you)` : ''}. ` +
              `The ${timing.agents} agents worked side by side: their part took ${timing.parallel} s, ` +
              `instead of about ${timing.oneByOne} s one after another.`
            : 'Click any card to see everything about it.'}
        </p>
      </section>

      {bank.status === 'needs_you' && <ReviewPanel key={reviewKey(bank)} bank={bank} onDone={carryOn} />}

      {error && <p className="inline-error">{error}</p>}
      {bank.status === 'failed' && (
        <div className="inline-error" role="alert">
          <Icon name="alert" size={16} />
          <span>The panel stopped: {bank.error}</span>
        </div>
      )}
      {bank.status === 'running' && <p className="muted bank-wait">The questions show up here once the judge has checked them.</p>}

      {(bank.status === 'done' || bank.status === 'needs_you') && <RunTimeline steps={bank.steps} />}
      {bank.status === 'done' && <BankQuestions bank={bank} />}

      <AgentInspector stepId={inspecting} bank={bank} onClose={() => setInspecting(null)} />
    </div>
  )
}

// How long the run took, how long it waited for you, and what working in parallel saved.
function timingOf(steps) {
  const seconds = (ms) => (ms / 1000).toFixed(1)
  let first = Infinity
  let last = 0
  let waited = 0
  const agentMs = []
  for (const step of steps) {
    for (const run of step.runs || []) {
      const start = Date.parse(run.start)
      first = Math.min(first, start)
      last = Math.max(last, start + run.ms)
      if (step.kind === 'human') waited += run.ms
    }
    if (step.kind === 'agent' && step.runs && step.runs.length > 0) agentMs.push(step.runs[0].ms) // its first write
  }
  let oneByOne = 0
  for (const ms of agentMs) oneByOne += ms
  return {
    total: seconds(last - first),
    waited: waited ? seconds(waited) : '',
    agents: agentMs.length,
    parallel: seconds(Math.max(0, ...agentMs)),
    oneByOne: seconds(oneByOne),
  }
}

// A new key for each pause, so the review form starts fresh (the judge can ask twice).
function reviewKey(bank) {
  const judge = bank.steps.find((step) => step.kind === 'judge')
  return `${bank.pending.kind}-${judge.runs.length}`
}
