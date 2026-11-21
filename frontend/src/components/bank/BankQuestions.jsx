import { useState } from 'react'
import { lookOf, QUESTION_TYPES, SOURCES } from '../../lib/agents'
import { practiseFromBank } from '../../lib/api'
import { go } from '../../lib/router'
import Icon from '../Icon'
import { ScoreChips } from './ReviewPanel'

const MAX_INTERVIEW = 20 // the most questions one mock interview takes

// The questions the judge kept. Q&A questions are picked for one mock interview;
// a whiteboard or coding question starts its own round.
export default function BankQuestions({ bank }) {
  const [type, setType] = useState('all')
  const [picked, setPicked] = useState([]) // Q&A question ids
  const [voice, setVoice] = useState(false)
  const [starting, setStarting] = useState('') // which button is working
  const [error, setError] = useState('')

  const names = Object.fromEntries(bank.steps.filter((s) => s.kind === 'agent').map((s) => [s.agent, s.name]))
  const practisedIn = {} // question id -> the page of the latest round it was practised in
  bank.practised.forEach((round) => round.question_ids.forEach((id) => (practisedIn[id] = round.page)))
  const qaIds = bank.questions.filter((q) => q.type === 'qa').map((q) => q.id)
  const shown = bank.questions.filter((q) => type === 'all' || q.type === type)

  function toggle(id) {
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id].slice(0, MAX_INTERVIEW))
  }

  async function practise(key, questionIds, options = {}) {
    setStarting(key)
    setError('')
    try {
      const { page } = await practiseFromBank(bank.id, { questionIds, ...options })
      go(page)
    } catch (err) {
      setError(err.message)
      setStarting('')
    }
  }

  return (
    <section className="card bank-questions">
      <div className="bank-questions-head">
        <h2>{bank.questions.length} questions</h2>
        <div className="chips-row">
          {['all', 'qa', 'whiteboard', 'coding'].map((kind) => {
            const count = kind === 'all' ? bank.questions.length : bank.questions.filter((q) => q.type === kind).length
            return (
              <button
                key={kind}
                type="button"
                className={`chip-btn${type === kind ? ' on' : ''}`}
                onClick={() => setType(kind)}
                disabled={count === 0}
              >
                {kind === 'all' ? 'All' : QUESTION_TYPES[kind].label} · {count}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="inline-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="bank-q-list">
        {shown.map((q) => (
          <article key={q.id} className={`bank-q${picked.includes(q.id) ? ' picked' : ''}`}>
            <div className="bank-q-top">
              {q.type === 'qa' && (
                <input
                  type="checkbox"
                  checked={picked.includes(q.id)}
                  onChange={() => toggle(q.id)}
                  aria-label="Pick for the mock interview"
                />
              )}
              <span className="q-type">
                <Icon name={QUESTION_TYPES[q.type].icon} size={13} />
                {QUESTION_TYPES[q.type].label}
              </span>
              <span className={`q-difficulty ${q.difficulty}`}>{q.difficulty}</span>
              <span className="q-agent">
                <span className="q-dot" style={{ background: lookOf(q.agent).color }} />
                {names[q.agent] || q.agent}
              </span>
              {q.source && (
                <span className="q-source" title={`“${q.based_on}”${q.source_detail ? ` (${q.source_detail})` : ''}`}>
                  <Icon name="check" size={12} />
                  {SOURCES[q.source]}
                </span>
              )}
              {q.restored && <span className="q-restored">Kept by you</span>}
            </div>

            <p className="bank-q-text">{q.question}</p>
            {q.detail && <p className="muted small bank-q-detail">{q.detail}</p>}
            <ScoreChips scores={q.scores} />

            <details className="bank-q-answer">
              <summary>What a good answer covers</summary>
              <ul>
                {q.key_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {q.based_on && (
                <p className="q-quote">
                  Asked because of: “{q.based_on}”{q.source_detail ? ` (${q.source_detail})` : ''}
                </p>
              )}
            </details>

            <div className="bank-q-actions">
              {practisedIn[q.id] && (
                <a className="q-practised" href={`#/${practisedIn[q.id]}`}>
                  <Icon name="check" size={13} />
                  Practised · open
                </a>
              )}
              {q.type === 'whiteboard' && (
                <button className="small primary" onClick={() => practise(q.id, [q.id])} disabled={Boolean(starting)}>
                  <Icon name="pen" size={14} />
                  {starting === q.id ? 'Starting…' : 'Start whiteboard'}
                </button>
              )}
              {q.type === 'coding' && (
                <>
                  <button
                    className="small"
                    onClick={() => practise(`${q.id}-practice`, [q.id], { codingMode: 'practice' })}
                    disabled={Boolean(starting)}
                  >
                    {starting === `${q.id}-practice` ? 'Starting…' : 'Practice mode'}
                  </button>
                  <button
                    className="small primary"
                    onClick={() => practise(`${q.id}-interview`, [q.id], { codingMode: 'interview' })}
                    disabled={Boolean(starting)}
                  >
                    <Icon name="code" size={14} />
                    {starting === `${q.id}-interview` ? 'Starting…' : 'Interview mode'}
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {qaIds.length > 0 && (
        <div className="bank-bar">
          <span className="bank-bar-text">
            {picked.length ? (
              <b>{picked.length} picked for a mock interview</b>
            ) : (
              <span className="muted">Tick Q&A questions to practise them as a mock interview.</span>
            )}
          </span>
          <button type="button" className="small" onClick={() => setPicked(picked.length ? [] : qaIds.slice(0, MAX_INTERVIEW))}>
            {picked.length ? 'Clear' : 'Pick all Q&A'}
          </button>
          <label className="bank-voice">
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
            Voice
          </label>
          <button
            className="primary"
            onClick={() => practise('interview', picked, { voice })}
            disabled={!picked.length || Boolean(starting)}
          >
            <Icon name="play" size={15} />
            {starting === 'interview' ? 'Starting…' : 'Start mock interview'}
          </button>
        </div>
      )}

      {bank.dropped.length > 0 && (
        <details className="bank-dropped">
          <summary>
            The judge removed {bank.dropped.length} {bank.dropped.length === 1 ? 'question' : 'questions'}
          </summary>
          <ul>
            {bank.dropped.map((drop) => (
              <li key={drop.id}>
                <span className="q-dot" style={{ background: lookOf(drop.agent).color }} />
                <span>
                  {drop.question}
                  <span className="muted small"> · {names[drop.agent] || drop.agent}: {drop.reason}</span>
                  <ScoreChips scores={drop.scores} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
