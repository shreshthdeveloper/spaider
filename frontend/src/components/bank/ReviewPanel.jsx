import { useState } from 'react'
import { lookOf, RUBRIC } from '../../lib/agents'
import { reviewBank } from '../../lib/api'
import Icon from '../Icon'
import AgentAvatar from './AgentAvatar'

// Review mode (human in the loop): the panel has paused and asks you something (bank.pending).
//   kind "plan":    approve the lead's plan; edit any brief, or take an agent off the panel
//   kind "verdict": allow or block the judge's send-back, and keep any question it dropped
// onDone(bank) gets the bank back once the panel carries on.
export default function ReviewPanel({ bank, onDone }) {
  if (bank.pending.kind === 'plan') return <PlanReview bank={bank} onDone={onDone} />
  return <VerdictReview bank={bank} onDone={onDone} />
}

function PlanReview({ bank, onDone }) {
  const agents = bank.steps.filter((step) => step.kind === 'agent')
  const [kept, setKept] = useState(agents.map((step) => step.agent))
  const [briefs, setBriefs] = useState(bank.pending.briefs)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function toggle(agentId) {
    if (kept.includes(agentId)) setKept(kept.filter((id) => id !== agentId))
    else setKept([...kept, agentId])
  }

  async function approve() {
    setSending(true)
    setError('')
    try {
      onDone(await reviewBank(bank.id, { agents: kept, briefs }))
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <section className="card review-panel">
      <ReviewHead title="Approve the plan">
        The panel lead wrote a brief for each agent. Edit any of them, or take an agent off the panel. Nothing runs
        until you approve.
      </ReviewHead>
      <p className="review-plan">
        <b>Plan:</b> {bank.pending.plan}
      </p>

      <div className="review-agents">
        {agents.map((step) => {
          const on = kept.includes(step.agent)
          return (
            <div key={step.agent} className={`review-agent${on ? '' : ' off'}`}>
              <AgentAvatar id={step.agent} size="small" />
              <div className="review-agent-body">
                <label className="review-agent-head">
                  <span className="step-name">{step.name}</span>
                  <input type="checkbox" checked={on} onChange={() => toggle(step.agent)} />
                  <span className="muted small">{on ? 'On the panel' : 'Off the panel'}</span>
                </label>
                <textarea
                  rows={2}
                  value={briefs[step.agent] || ''}
                  onChange={(e) => setBriefs({ ...briefs, [step.agent]: e.target.value })}
                  disabled={!on || sending}
                  maxLength={800}
                  aria-label={`Brief for ${step.name}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="inline-error">{error}</p>}
      <div className="review-actions">
        <button className="primary" onClick={approve} disabled={!kept.length || sending}>
          <Icon name="check" size={15} />
          {sending ? 'Starting the agents…' : `Approve and start ${kept.length} agents`}
        </button>
      </div>
    </section>
  )
}

function VerdictReview({ bank, onDone }) {
  const { send_back: sendBack, drops } = bank.pending
  const names = {}
  for (const step of bank.steps) names[step.agent] = step.name
  const [allow, setAllow] = useState(true)
  const [note, setNote] = useState(sendBack?.note || '')
  const [restore, setRestore] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function toggle(questionId) {
    if (restore.includes(questionId)) setRestore(restore.filter((id) => id !== questionId))
    else setRestore([...restore, questionId])
  }

  async function confirm() {
    setSending(true)
    setError('')
    try {
      onDone(await reviewBank(bank.id, { allow_send_back: Boolean(sendBack) && allow, send_back_note: note, restore }))
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <section className="card review-panel">
      <ReviewHead title="Review the judge's call">
        The judge scored every question. You have the last word: allow or block its send-back, and keep any question
        it dropped.
      </ReviewHead>
      <p className="review-plan">
        <b>Judge:</b> {bank.pending.summary}
      </p>

      {sendBack && (
        <div className="review-sendback">
          <div className="review-sendback-head">
            <AgentAvatar id="judge" size="small" />
            <span>
              The judge wants to send <b>{names[sendBack.agent]}</b> back to rewrite its set:
            </span>
          </div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={!allow || sending} maxLength={600} />
          <div className="chips-row">
            <button type="button" className={`chip-btn${allow ? ' on' : ''}`} onClick={() => setAllow(true)}>
              <Icon name="repeat" size={13} />
              Allow: rewrite it
            </button>
            <button type="button" className={`chip-btn${allow ? '' : ' on'}`} onClick={() => setAllow(false)}>
              <Icon name="x" size={13} />
              Block: keep its set
            </button>
          </div>
        </div>
      )}

      <h3 className="section-title">Dropped by the judge ({drops.length})</h3>
      {drops.length === 0 && <p className="muted small">Nothing was dropped.</p>}
      <div className="review-drops">
        {drops.map((drop) => (
          <label key={drop.id} className={`review-drop${restore.includes(drop.id) ? ' kept' : ''}`}>
            <input type="checkbox" checked={restore.includes(drop.id)} onChange={() => toggle(drop.id)} />
            <span className="review-drop-body">
              <span className="review-drop-text">{drop.question}</span>
              <span className="muted small">
                <span className="q-dot" style={{ background: lookOf(drop.agent).color }} /> {names[drop.agent]} · {drop.reason}
              </span>
              <ScoreChips scores={drop.scores} />
            </span>
            <span className="review-keep">{restore.includes(drop.id) ? 'Kept' : 'Keep it'}</span>
          </label>
        ))}
      </div>

      {error && <p className="inline-error">{error}</p>}
      <div className="review-actions">
        <button className="primary" onClick={confirm} disabled={sending}>
          <Icon name="check" size={15} />
          {sending ? 'Sending…' : 'Confirm'}
        </button>
      </div>
    </section>
  )
}

function ReviewHead({ title, children }) {
  return (
    <div className="review-head">
      <AgentAvatar id="you" />
      <div>
        <span className="eyebrow">Your turn · human in the loop</span>
        <h2>{title}</h2>
        <p className="muted small">{children}</p>
      </div>
    </div>
  )
}

// The judge's four scores, 1 to 5. Low ones (3 or less) stand out.
export function ScoreChips({ scores }) {
  if (!scores) return null
  return (
    <span className="score-chips" title="The judge's scores, out of 5">
      {RUBRIC.map((item) => (
        <span key={item.id} className={`score-chip${scores[item.id] <= 3 ? ' low' : ''}`}>
          {item.label} {scores[item.id]}
        </span>
      ))}
    </span>
  )
}
