import { useEffect, useState } from 'react'
import { listWhiteboardQuestions, listWhiteboards, startWhiteboard } from '../../lib/api'
import { formatDate, scoreClass } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'

const HOW_IT_WORKS = [
  { icon: 'pen', title: 'Draw', text: 'Sketch your design on a real whiteboard: boxes, arrows, notes.' },
  { icon: 'eye', title: 'Bella watches', text: 'When you pause, she looks at the board, speaks, and pins notes.' },
  { icon: 'trophy', title: 'Report', text: 'A rubric score, where every point is backed by your board.' },
]

// #/whiteboard: pick a system design question (or write your own), then start. Past rounds are below.
export default function WhiteboardSetup() {
  const [questions, setQuestions] = useState([])
  const [picked, setPicked] = useState('') // a question id, or 'own' for your own question
  const [ownQuestion, setOwnQuestion] = useState('')
  const [ownBrief, setOwnBrief] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [past, setPast] = useState(null)

  useEffect(() => {
    listWhiteboardQuestions()
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err.message))
    listWhiteboards()
      .then((data) => setPast(data.sessions))
      .catch(() => setPast([]))
  }, [])

  const ready = picked === 'own' ? ownQuestion.trim() !== '' : picked !== ''

  async function start() {
    if (!ready || starting) return
    setStarting(true)
    setError('')
    try {
      const choice = picked === 'own' ? { question: ownQuestion.trim(), brief: ownBrief.trim() } : { questionId: picked }
      const session = await startWhiteboard(choice)
      go(`whiteboard/${session.id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="page wb-setup">
      <header className="page-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1>System design whiteboard</h1>
          <p className="muted">Design a system on a whiteboard while an AI interviewer watches, asks and grades.</p>
        </div>
      </header>

      <div className="wb-how">
        {HOW_IT_WORKS.map((step, i) => (
          <div key={step.title} className="wb-how-step">
            <span className="how-icon">
              <Icon name={step.icon} size={16} />
            </span>
            <div>
              <b>
                {i + 1}. {step.title}
              </b>
              <div className="muted small">{step.text}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="wb-h2">Pick a question</h2>
        <div className="wb-questions">
          {questions.map((question) => (
            <button
              key={question.id}
              className={`wb-question${picked === question.id ? ' on' : ''}`}
              onClick={() => setPicked(question.id)}
              disabled={starting}
            >
              <b>{question.title}</b>
              <span className="muted small">{question.brief}</span>
            </button>
          ))}
          <button className={`wb-question own${picked === 'own' ? ' on' : ''}`} onClick={() => setPicked('own')} disabled={starting}>
            <b>
              <Icon name="plus" size={14} /> Your own question
            </b>
            <span className="muted small">Practise the exact design question you expect.</span>
          </button>
        </div>

        {picked === 'own' && (
          <div className="wb-own">
            <label className="field-label" htmlFor="own-question">
              Question
            </label>
            <input
              id="own-question"
              value={ownQuestion}
              maxLength={500}
              onChange={(e) => setOwnQuestion(e.target.value)}
              placeholder="e.g. Design a food delivery app"
            />
            <label className="field-label" htmlFor="own-brief">
              What it must handle <span className="muted">(optional)</span>
            </label>
            <input
              id="own-brief"
              value={ownBrief}
              maxLength={500}
              onChange={(e) => setOwnBrief(e.target.value)}
              placeholder="e.g. 1 million orders a day, live courier tracking"
            />
          </div>
        )}

        <div className="wb-start">
          {error && (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          <button className="primary big" onClick={start} disabled={!ready || starting}>
            {starting ? <span className="spinner small" /> : <Icon name="play" size={16} />}
            Start the whiteboard
          </button>
        </div>
      </section>

      <h2 className="section-title">Past rounds</h2>
      <section className="card">
        {past === null && <SpiderLoader size="small" label="Loading your rounds…" />}
        {past && past.length === 0 && <p className="muted">No rounds yet. Your first one will show up here.</p>}
        <div className="past-list">
          {(past || []).map((item) => (
            <a key={item.id} className="past-row" href={`#/whiteboard/${item.id}`}>
              <span className={`past-icon${item.status === 'finished' ? ' done' : ''}`}>
                <Icon name={item.status === 'finished' ? 'check' : 'pen'} size={16} />
              </span>
              <span className="past-text">
                <span className="past-topic">{item.question}</span>
                <span className="muted small">
                  {formatDate(item.created_at)} · {item.status === 'finished' ? 'Finished' : 'In progress'}
                </span>
              </span>
              {item.status === 'finished' ? (
                <span className={`badge ${scoreClass(item.overall)}`}>{item.overall}/5</span>
              ) : (
                <span className="badge badge-progress">Continue</span>
              )}
              <Icon name="chevron" size={16} className="past-chevron" />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
