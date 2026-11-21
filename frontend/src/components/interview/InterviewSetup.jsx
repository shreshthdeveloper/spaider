import { useEffect, useState } from 'react'
import { listInterviews, startInterview } from '../../lib/api'
import { estimateMinutes } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import InterviewTabs from './InterviewTabs'
import { TOPIC_AREAS } from './topics'

const MAX_TOPIC = 4000
const MAX_QUESTIONS = 20

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', hint: 'Fundamentals and definitions' },
  { id: 'medium', label: 'Medium', hint: 'How and why, with examples' },
  { id: 'hard', label: 'Hard', hint: 'Trade-offs, edge cases, design decisions' },
  { id: 'mixed', label: 'Mixed', hint: 'Starts easy, then goes deeper' },
]

const FOLLOW_UPS = [
  { value: 0, label: 'None', hint: 'Straight to the next question' },
  { value: 1, label: '1', hint: 'One follow-up when you miss something' },
  { value: 2, label: '2', hint: 'Digs deeper, like a tough interviewer' },
]

const MODES = [
  { id: 'text', icon: 'chat', title: 'Text', text: 'Read each question and type your answer.' },
  { id: 'voice', icon: 'mic', title: 'Voice', text: 'A 3D interviewer asks out loud. Answer with your mic.' },
]

const HOW_IT_WORKS = [
  { icon: 'layers', title: 'Plan', text: 'Your topics become a set of questions.' },
  { icon: 'chat', title: 'Interview', text: 'One at a time, with follow-ups on gaps.' },
  { icon: 'trophy', title: 'Report', text: 'A score and what to study next.' },
]

// "Python basics, Caching. Focus on production issues" — what the planner receives.
function buildTopic(picked, extra) {
  const parts = []
  if (picked.length > 0) parts.push(picked.join(', '))
  if (extra.trim()) parts.push(extra.trim())
  return parts.join('. ')
}

// Tab 1 of the mock interview: choose what to practise and how, then start.
// Wide screens: the form on the left, and a summary with the Start button on the right that stays in view.
export default function InterviewSetup() {
  const [area, setArea] = useState(TOPIC_AREAS[0].area)
  const [picked, setPicked] = useState([]) // topics chosen from the library
  const [extra, setExtra] = useState('') // own focus, or a pasted job description
  const [numQuestions, setNumQuestions] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')
  const [followUps, setFollowUps] = useState(1)
  const [mode, setMode] = useState('text')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [pastCount, setPastCount] = useState(null) // for the "Past interviews" tab

  useEffect(() => {
    listInterviews()
      .then((data) => setPastCount(data.interviews.length))
      .catch(() => {})
  }, [])

  const topic = buildTopic(picked, extra)
  const areaTopics = TOPIC_AREAS.find((a) => a.area === area).topics
  const chosenDifficulty = DIFFICULTIES.find((d) => d.id === difficulty)
  const chosenFollowUps = FOLLOW_UPS.find((f) => f.value === followUps)

  function togglePick(name) {
    if (picked.includes(name)) setPicked(picked.filter((t) => t !== name))
    else setPicked([...picked, name])
  }

  async function start() {
    if (!topic || starting) return
    if (topic.length > MAX_TOPIC) {
      setError(`That is too long (max ${MAX_TOPIC} characters). Shorten the job description.`)
      return
    }
    setStarting(true)
    setError('')
    try {
      const interview = await startInterview({ topic, numQuestions, difficulty, followUps, mode })
      go(`interview/${interview.id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="page interview-page">
      <InterviewTabs current="new" count={pastCount} />

      <div className="setup-layout">
        <div className="setup-form">
          {/* ---------- 1. what to practise ---------- */}
          <section className="card setup-card">
            <StepTitle number={1} title="What do you want to practise?">
              Pick topics from the library, add your own focus, or paste a job description.
            </StepTitle>

            <div className="topic-tabs">
              {TOPIC_AREAS.map((a) => {
                const count = a.topics.filter((t) => picked.includes(t)).length
                return (
                  <button
                    key={a.area}
                    type="button"
                    className={`topic-tab${area === a.area ? ' on' : ''}`}
                    onClick={() => setArea(a.area)}
                  >
                    <Icon name={a.icon} size={15} />
                    {a.area}
                    {count > 0 && <span className="topic-count">{count}</span>}
                  </button>
                )
              })}
            </div>

            <div className="chips-row topic-chips">
              {areaTopics.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip-btn${picked.includes(name) ? ' on' : ''}`}
                  onClick={() => togglePick(name)}
                  disabled={starting}
                >
                  <Icon name={picked.includes(name) ? 'check' : 'plus'} size={13} />
                  {name}
                </button>
              ))}
            </div>

            <div className="extra-head">
              <label className="field-label" htmlFor="extra">
                Your own focus or a job description <span className="muted">(optional)</span>
              </label>
              {extra.length > 0 && (
                <span className={`muted small${extra.length > MAX_TOPIC ? ' too-long' : ''}`}>
                  {extra.length} / {MAX_TOPIC}
                </span>
              )}
            </div>
            <textarea
              id="extra"
              rows={3}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. Focus on production issues and debugging. Or paste the full job description here."
              disabled={starting}
            />
          </section>

          {/* ---------- 2. how ---------- */}
          <section className="card setup-card">
            <StepTitle number={2} title="How should it run?">
              Length, difficulty and how you want to answer.
            </StepTitle>

            <div className="setting">
              <div className="setting-head">
                <span className="field-label">Questions</span>
                <span className="setting-value">{numQuestions}</span>
              </div>
              <input
                type="range"
                min={1}
                max={MAX_QUESTIONS}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                disabled={starting}
                aria-label="Number of questions"
              />
              <div className="range-ends muted small">
                <span>1 · quick check</span>
                <span>{MAX_QUESTIONS} · full round</span>
              </div>
            </div>

            <div className="settings-grid">
              <div className="setting">
                <span className="field-label">Difficulty</span>
                <div className="seg full">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={difficulty === d.id ? 'on' : ''}
                      onClick={() => setDifficulty(d.id)}
                      disabled={starting}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="muted small setting-hint">{chosenDifficulty.hint}</div>
              </div>

              <div className="setting">
                <span className="field-label">Follow-ups per question</span>
                <div className="seg full">
                  {FOLLOW_UPS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      className={followUps === f.value ? 'on' : ''}
                      onClick={() => setFollowUps(f.value)}
                      disabled={starting}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="muted small setting-hint">{chosenFollowUps.hint}</div>
              </div>
            </div>

            <div className="setting">
              <span className="field-label">Mode</span>
              <div className="mode-cards">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mode-card${mode === m.id ? ' on' : ''}`}
                    onClick={() => setMode(m.id)}
                    disabled={starting}
                  >
                    <span className="mode-icon">
                      <Icon name={m.icon} size={18} />
                    </span>
                    <span className="mode-text">
                      <span className="mode-title">{m.title}</span>
                      <span className="muted small">{m.text}</span>
                    </span>
                    <span className="mode-check">{mode === m.id && <Icon name="check" size={13} />}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ---------- summary + start ---------- */}
        <aside className="card summary-card">
          <div className="summary-head">
            <span className="eyebrow">Your interview</span>
            <span className="summary-time">
              <Icon name="clock" size={14} />
              about {estimateMinutes(numQuestions, followUps)} min
            </span>
          </div>

          <div className="summary-topics">
            {!topic && <p className="muted small">No topic yet. Pick one from the library, or describe your own focus.</p>}
            {picked.map((name) => (
              <button key={name} type="button" className="picked-chip" onClick={() => togglePick(name)} title="Remove">
                {name}
                <Icon name="x" size={12} />
              </button>
            ))}
            {extra.trim() && (
              <span className="picked-chip own">
                <Icon name="sparkle" size={12} />
                Your own focus
              </span>
            )}
          </div>

          <dl className="summary-facts">
            <div>
              <dt>Questions</dt>
              <dd>{numQuestions}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{chosenDifficulty.label}</dd>
            </div>
            <div>
              <dt>Follow-ups</dt>
              <dd>{followUps === 0 ? 'None' : `Up to ${followUps} each`}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>
                <Icon name={mode === 'voice' ? 'mic' : 'chat'} size={14} />
                {mode === 'voice' ? 'Voice' : 'Text'}
              </dd>
            </div>
          </dl>

          <button className="primary big start-btn" onClick={start} disabled={!topic || starting}>
            {starting ? (
              <>
                <span className="spinner small" />
                Planning your interview…
              </>
            ) : (
              <>
                <Icon name="play" size={16} />
                Start interview
              </>
            )}
          </button>

          {error && (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <ol className="how-list">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.title}>
                <span className="how-icon">
                  <Icon name={step.icon} size={15} />
                </span>
                <span>
                  <b>{step.title}</b>
                  <span className="muted small">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}

function StepTitle({ number, title, children }) {
  return (
    <div className="setup-step">
      <span className="step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p className="muted small">{children}</p>
      </div>
    </div>
  )
}
