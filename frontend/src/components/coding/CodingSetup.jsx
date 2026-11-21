import { useEffect, useState } from 'react'
import { listCodingProblems, listCodingRounds, startCodingRound } from '../../lib/api'
import { formatDate, scoreClass } from '../../lib/format'
import { go } from '../../lib/router'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'

const MODES = [
  {
    id: 'interview',
    icon: 'target',
    title: 'Interview',
    text: 'Bella acts like a real interviewer: she points out problems and asks questions, but never gives the answer. Each hint costs 0.5 points.',
  },
  {
    id: 'practice',
    icon: 'sparkle',
    title: 'Practice',
    text: 'Bella is your coach: she explains, suggests techniques ("try a hash map here") and walks you through the next step. Hints are free.',
  },
]

const DIFFICULTIES = [
  { id: '', label: 'All' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
]

// #/coding: pick a problem (or let SpAIder pick one you haven't finished), pick a mode, start.
export default function CodingSetup() {
  const [problems, setProblems] = useState([])
  const [mode, setMode] = useState('interview')
  const [difficulty, setDifficulty] = useState('')
  const [picked, setPicked] = useState('surprise') // a problem id, or 'surprise'
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [past, setPast] = useState(null)

  useEffect(() => {
    listCodingProblems()
      .then((data) => setProblems(data.problems))
      .catch((err) => setError(err.message))
    listCodingRounds()
      .then((data) => setPast(data.sessions))
      .catch(() => setPast([]))
  }, [])

  const shown = problems.filter((problem) => !difficulty || problem.difficulty === difficulty)

  async function start() {
    if (starting) return
    setStarting(true)
    setError('')
    try {
      const session = await startCodingRound({ problemId: picked, difficulty, mode })
      go(`coding/${session.id}`)
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
          <h1>Coding round</h1>
          <p className="muted">Solve a Python problem while Bella watches. Tests check your code; Bella checks your thinking.</p>
        </div>
      </header>

      <section className="card">
        <h2 className="wb-h2">1. How should Bella behave?</h2>
        <div className="code-modes">
          {MODES.map((m) => (
            <button key={m.id} className={`mode-card${mode === m.id ? ' on' : ''}`} onClick={() => setMode(m.id)}>
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

        <div className="code-pick-head">
          <h2 className="wb-h2">2. Pick a problem</h2>
          <div className="seg">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} className={difficulty === d.id ? 'on' : ''} onClick={() => setDifficulty(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="wb-questions">
          <button className={`wb-question own${picked === 'surprise' ? ' on' : ''}`} onClick={() => setPicked('surprise')}>
            <b>
              <Icon name="sparkle" size={14} /> Surprise me
            </b>
            <span className="muted small">
              A {difficulty || 'random'} problem you haven't finished yet, like a real interview.
            </span>
          </button>
          {shown.map((problem) => (
            <button
              key={problem.id}
              className={`wb-question${picked === problem.id ? ' on' : ''}`}
              onClick={() => setPicked(problem.id)}
            >
              <b>{problem.title}</b>
              <span className="code-tags">
                <span className={`code-tag ${problem.difficulty}`}>{problem.difficulty}</span>
                <span className="code-tag">{problem.topic}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="wb-start">
          {error && (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          <button className="primary big" onClick={start} disabled={starting}>
            {starting ? <span className="spinner small" /> : <Icon name="play" size={16} />}
            Start coding
          </button>
        </div>
      </section>

      <h2 className="section-title">Past rounds</h2>
      <section className="card">
        {past === null && <SpiderLoader size="small" label="Loading your rounds…" />}
        {past && past.length === 0 && <p className="muted">No rounds yet. Your first one will show up here.</p>}
        <div className="past-list">
          {(past || []).map((item) => (
            <a key={item.id} className="past-row" href={`#/coding/${item.id}`}>
              <span className={`past-icon${item.status === 'finished' ? ' done' : ''}`}>
                <Icon name={item.status === 'finished' ? 'check' : 'code'} size={16} />
              </span>
              <span className="past-text">
                <span className="past-topic">{item.title}</span>
                <span className="muted small">
                  {formatDate(item.created_at)} · {item.mode === 'practice' ? 'Practice' : 'Interview'} ·{' '}
                  {item.status === 'finished' ? 'Finished' : 'In progress'}
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
