import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import AgentAvatar from './AgentAvatar'

// The panel at work, drawn from bank.steps (written by services/question_bank/runner.py):
//
//   Panel lead (+ You)  ──>  agents, all at the same time  ──>  Judge (+ You)
//
// "You" cards only appear in review mode (human in the loop). Each card shows what the member was told
// (the lead's brief, or the judge's note) and what it did; click one to see everything about it.
// When the judge sends an agent back, an orange arrow runs from the judge to that agent.
export default function AgentPipeline({ steps, onInspect }) {
  const byId = {}
  for (const step of steps) byId[step.id] = step
  const agents = steps.filter((step) => step.kind === 'agent')
  const judge = byId.judge
  const now = useNow(steps.some(isBusy))

  const pipelineRef = useRef(null)
  const judgeRef = useRef(null)
  const laneRefs = useRef({}) // agent id -> its lane, to aim the send-back arrow

  const card = (step, face) => <StepCard step={step} face={face} now={now} onInspect={onInspect} />

  return (
    <div className="pipeline" ref={pipelineRef}>
      <div className="pipe-stage lead">
        <span className="pipe-label">1 · Plan</span>
        {card(byId.coordinator, 'coordinator')}
        {byId['you:plan'] && <HumanLink step={byId['you:plan']} />}
        {byId['you:plan'] && card(byId['you:plan'], 'you')}
      </div>

      <Link lit={agents.some((step) => step.status !== 'waiting')} flowing={agents.some(isBusy)} />

      <div className="pipe-stage agents">
        <span className="pipe-label">2 · Write, in parallel</span>
        <div className="pipe-lanes">
          {agents.map((step) => (
            <div
              key={step.id}
              className={`pipe-lane${isBusy(step) ? ' busy' : ''}`}
              ref={(element) => (laneRefs.current[step.agent] = element)}
            >
              {/* the rails join each lane to the next, on both sides */}
              <span className="lane-rail left" aria-hidden="true" />
              <span className="lane-rail right" aria-hidden="true" />
              {card(step, step.agent)}
            </div>
          ))}
        </div>
      </div>

      <Link lit={judge.status !== 'waiting' || Boolean(judge.sent_back)} flowing={isBusy(judge)} />

      <div className="pipe-stage judge" ref={judgeRef}>
        <span className="pipe-label">3 · Judge</span>
        {card(judge, 'judge')}
        {byId['you:review'] && <HumanLink step={byId['you:review']} />}
        {byId['you:review'] && card(byId['you:review'], 'you')}
      </div>

      <SendBackArrow
        judge={judge}
        agents={agents}
        pipelineRef={pipelineRef}
        judgeRef={judgeRef}
        laneRefs={laneRefs}
      />
    </div>
  )
}

function StepCard({ step, face, now, onInspect }) {
  const sentBack = step.kind === 'judge' ? step.sent_back : null
  return (
    <button type="button" className={`step-card ${step.kind} ${step.status}`} onClick={() => onInspect(step)}>
      <AgentAvatar id={face} busy={isBusy(step)} />
      <span className="step-text">
        <span className="step-top">
          <span className="step-name">{step.name}</span>
          <StatusChip step={step} now={now} />
        </span>
        {step.message && (
          <span className={`step-message${step.message.startsWith('Judge:') ? ' from-judge' : ''}`}>{step.message}</span>
        )}
        {step.searches?.length > 0 && <Searches searches={step.searches} />}
        {step.note && !isBusy(step) && step.status !== 'needs_you' && (
          <span className={`step-note${step.status === 'failed' ? ' failed' : ''}`}>{step.note}</span>
        )}
        {sentBack && (
          <span className={`step-sent${sentBack.blocked ? ' blocked' : ''}`}>
            {sentBack.blocked ? 'You blocked its send-back: ' : 'Sent back once: '}
            {sentBack.note}
          </span>
        )}
      </span>
    </button>
  )
}

// The agent's tool calls: what it searched in your documents, and where it found something.
function Searches({ searches }) {
  return (
    <span className="step-searches">
      {searches.map((search, i) => (
        <span key={i} className="step-search" title={search.found.join(', ') || 'Nothing relevant found'}>
          <Icon name="search" size={11} />
          {search.query}
          <b>{search.found.length ? `· ${search.found[0]}` : '· nothing'}</b>
        </span>
      ))}
    </span>
  )
}

function StatusChip({ step, now }) {
  const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`
  const running = step.started_at ? Math.max(0, now - Date.parse(step.started_at)) : 0
  const texts = {
    waiting: 'Waiting',
    thinking: `Thinking ${seconds(running)}`,
    revising: `Rewriting ${seconds(running)}`,
    needs_you: 'Your turn',
    done: step.ms == null ? 'Done' : `Done · ${seconds(step.ms)}`,
    failed: 'Failed',
    skipped: 'Off the panel',
  }
  return <span className={`step-status ${step.status}`}>{texts[step.status]}</span>
}

function Link({ lit, flowing }) {
  return <span className={`pipe-link${lit ? ' lit' : ''}${flowing ? ' flowing' : ''}`} aria-hidden="true" />
}

// The short line from a lead or judge card down to its "You" card.
function HumanLink({ step }) {
  return <span className={`human-link${step.status === 'needs_you' ? ' waiting' : ''}`} aria-hidden="true" />
}

// A dashed orange curve from the judge back to the agent it sent back (desktop layout only).
function SendBackArrow({ judge, agents, pipelineRef, judgeRef, laneRefs }) {
  const [path, setPath] = useState(null)
  const sent = judge.sent_back && !judge.sent_back.blocked ? judge.sent_back.agent : null
  const target = agents.find((step) => step.agent === sent)
  const rewriting = target?.status === 'revising'

  useEffect(() => {
    if (!sent) return
    function measure() {
      const box = pipelineRef.current?.getBoundingClientRect()
      const judgeCard = judgeRef.current?.querySelector('.step-card')?.getBoundingClientRect()
      const lane = laneRefs.current[sent]?.getBoundingClientRect()
      if (!box || !judgeCard || !lane) return
      const fromX = judgeCard.left - box.left
      const fromY = judgeCard.top - box.top + 22
      const toX = lane.right - box.left
      const toY = lane.top - box.top + 22
      const bend = Math.max(40, (fromX - toX) * 0.9)
      setPath(`M${fromX} ${fromY} C${fromX - bend} ${fromY}, ${toX + bend} ${toY}, ${toX + 6} ${toY}`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(pipelineRef.current)
    return () => observer.disconnect()
  }, [sent, pipelineRef, judgeRef, laneRefs])

  if (!sent || !path) return null
  return (
    <svg className={`send-back${rewriting ? ' moving' : ''}`} aria-hidden="true">
      <defs>
        <marker id="send-back-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" />
        </marker>
      </defs>
      <path d={path} markerEnd="url(#send-back-head)" />
    </svg>
  )
}

function isBusy(step) {
  return step.status === 'thinking' || step.status === 'revising'
}

// The time now, ticking while something is busy (for the live "Thinking 2.4 s").
function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [active])
  return now
}
