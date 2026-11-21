import { useEffect, useState } from 'react'
import { getInterviewXray } from '../../lib/api'
import Icon from '../Icon'
import Modal from '../Modal'
import SpiderLoader from '../SpiderLoader'
import { STEP_NAMES } from './steps'

// Where each step sits in the picture. The middle column is the main path; follow-up and next question
// are the two loops back to "ask"; the curve on the right is "you pressed End".
const BOXES = {
  START: { x: 300, y: 16, w: 56, h: 20, label: 'start' },
  plan_questions: { x: 300, y: 64, w: 128, h: 32 },
  ask: { x: 300, y: 120, w: 128, h: 32 },
  grade: { x: 300, y: 196, w: 128, h: 32 },
  follow_up: { x: 170, y: 158, w: 96, h: 32 },
  next_question: { x: 56, y: 158, w: 96, h: 32 },
  write_report: { x: 300, y: 268, w: 128, h: 32 },
  END: { x: 300, y: 316, w: 56, h: 20, label: 'end' },
}

// Every arrow the graph can take: its drawing, where its count goes, and when it is taken.
const PATHS = [
  { key: 'START->plan_questions', d: 'M300 26 L300 46', at: [316, 38], why: 'A new interview starts here' },
  { key: 'plan_questions->ask', d: 'M300 80 L300 102', at: [316, 93], why: 'The first question' },
  { key: 'ask->grade', d: 'M300 136 L300 178', at: [316, 160], why: 'Your answer arrived' },
  { key: 'grade->follow_up', d: 'M236 190 C 196 190, 170 192, 170 176', at: [196, 190], why: 'A weak answer, and a follow-up is still allowed' },
  { key: 'follow_up->ask', d: 'M170 142 C 170 130, 196 126, 234 126', at: [190, 130], why: 'Ask the follow-up' },
  { key: 'grade->next_question', d: 'M236 204 C 140 222, 56 214, 56 176', at: [110, 211], why: 'A good answer, or no follow-ups left' },
  { key: 'next_question->ask', d: 'M56 142 C 56 112, 150 106, 234 110', at: [114, 113], why: 'Ask the next question' },
  { key: 'grade->write_report', d: 'M300 212 L300 250', at: [316, 234], why: 'That was the last question' },
  { key: 'ask->write_report', d: 'M364 120 C 440 120, 440 268, 364 268', at: [421, 194], why: 'You pressed End' },
  { key: 'write_report->END', d: 'M300 284 L300 304', at: [316, 297], why: 'Done' },
]

// The X-ray: the interview's graph with the path it really took, and every step in order with what it
// decided and why. It reads LangGraph's saved checkpoints (backend/services/interview/xray.py).
//   running     the step running right now while your answer is graded ('' when none)
//   refreshKey  changes whenever there may be new steps, so the X-ray loads them
export default function InterviewXray({ interviewId, open, onClose, running = '', refreshKey = '' }) {
  const [xray, setXray] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let stale = false // a newer load started; ignore this one
    getInterviewXray(interviewId)
      .then((data) => !stale && setXray(data))
      .catch((err) => !stale && setError(err.message))
    return () => {
      stale = true
    }
  }, [open, interviewId, refreshKey])

  const current = running || xray?.now.node || ''
  let status = xray?.now.label || ''
  if (running) status = `Running now: ${STEP_NAMES[running] || running}`

  return (
    <Modal open={open} onClose={onClose} side title="Interview X-ray" subtitle="Every step the AI took, what it decided, and why">
      {error && <p className="muted">{error}</p>}
      {!xray && !error && <SpiderLoader label="Reading the saved steps…" />}
      {xray && (
        <div className="xray">
          <div className={`xray-now${running ? ' running' : ''}`}>
            <span className="xray-pulse" />
            {status}
          </div>
          <XrayGraph taken={xray.taken} steps={xray.steps} current={current} />
          <p className="muted small xray-note">
            LangGraph saves the interview after every step. This reads those saves back. Key points stay hidden until the
            interview is finished.
          </p>
          <XrayTimeline steps={xray.steps} />
        </div>
      )}
    </Modal>
  )
}

function XrayGraph({ taken, steps, current }) {
  const visited = new Set(['START'])
  for (const step of steps) visited.add(step.node)
  if (taken['write_report->END']) visited.add('END')

  return (
    <svg className="xray-graph" viewBox="0 0 470 336" role="img" aria-label="The interview graph, with the path taken">
      <defs>
        <marker id="xray-head-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="xray-head on" />
        </marker>
        <marker id="xray-head-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="xray-head" />
        </marker>
      </defs>

      {PATHS.map((path) => {
        const count = taken[path.key] || 0
        return (
          <g key={path.key} className={`xray-path${count ? ' on' : ''}`}>
            <title>{`${path.why}${count ? ` · taken ${count}×` : ' · not taken yet'}`}</title>
            <path d={path.d} markerEnd={`url(#xray-head-${count ? 'on' : 'off'})`} />
            {count > 0 && (
              <text x={path.at[0]} y={path.at[1]} className="xray-count">
                ×{count}
              </text>
            )}
          </g>
        )
      })}

      {Object.entries(BOXES).map(([node, box]) => {
        let state = ''
        if (visited.has(node)) state = ' visited'
        if (node === current) state = ' current'
        return (
          <g key={node} className={`xray-node${state}`}>
            <rect x={box.x - box.w / 2} y={box.y - box.h / 2} width={box.w} height={box.h} rx={box.h / 2.6} />
            <text x={box.x} y={box.y + 4}>
              {box.label || STEP_NAMES[node]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// "you took 42 s" for your answers, "1.4 s" for the AI's steps.
function timeText(step) {
  if (step.ms == null) return ''
  const seconds = step.ms < 10000 ? (step.ms / 1000).toFixed(1) : Math.round(step.ms / 1000)
  if (step.node === 'ask') return `you took ${seconds} s`
  return `${seconds} s`
}

function XrayTimeline({ steps }) {
  if (steps.length === 0) return <p className="muted">No steps yet.</p>
  return (
    <ol className="xray-steps">
      {steps.map((step, i) => (
        <li key={i} className={`xray-step step-${step.node}`}>
          <span className="xray-dot" />
          <div className="xray-step-body">
            <div className="xray-step-head">
              <span className="xray-chip">{STEP_NAMES[step.node] || step.node}</span>
              <b>{step.title}</b>
              <span className="muted small">{timeText(step)}</span>
            </div>
            {step.details.map((line, j) => (
              <p key={j} className="xray-detail" title={line}>
                {line}
              </p>
            ))}
            {step.next && (
              <p className="xray-why">
                <Icon name="arrow" size={13} />
                <span>
                  <b>Next: {STEP_NAMES[step.next]}.</b> {step.reason}
                </span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
