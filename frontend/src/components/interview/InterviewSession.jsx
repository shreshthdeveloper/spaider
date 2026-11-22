import { useEffect, useMemo, useRef, useState } from 'react'
import { answerInterviewLive, endInterview, getInterview, retryInterview } from '../../lib/api'
import { plural } from '../../lib/format'
import { useInterviewVoice } from '../../lib/useInterviewVoice'
import ConfirmDialog from '../ConfirmDialog'
import FocusButton from '../focus/FocusButton'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import { SpiderArt } from '../SpiderLoader'
import CallView from './CallView'
import InterviewReport from './InterviewReport'
import InterviewXray from './InterviewXray'
import { doingNow, STEP_NAMES } from './steps'

const NO_PREFACE = [] // the same empty list every time (see useInterviewVoice)

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mixed: 'Mixed difficulty' }

// "Hard · up to 1 follow-up"
function settingsLine(interview) {
  const difficulty = DIFFICULTY_LABELS[interview.difficulty] || 'Mixed difficulty'
  if (interview.max_follow_ups === 0) return `${difficulty} · no follow-ups`
  return `${difficulty} · up to ${plural(interview.max_follow_ups, 'follow-up')}`
}

const BUSY_TEXT = {
  loading: 'Loading the interview…',
  ending: 'Writing your report…',
  retrying: 'Trying again…',
}

// Screen 2: one question at a time. When the interview is finished, it shows the report instead.
// Voice on = a full-screen video call with the 3D interviewer (CallView). Voice off = the text screen below.
export default function InterviewSession({ id }) {
  const [interview, setInterview] = useState(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState('loading') // '' when idle, otherwise a key of BUSY_TEXT
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false) // the "End the interview?" box is open
  const [liveSteps, setLiveSteps] = useState([]) // the graph steps of the answer being graded: [{ node, done }]
  const [xrayOpen, setXrayOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    getInterview(id)
      .then(setInterview)
      .catch((err) => (err.status === 404 ? setMissing(true) : setError(err.message)))
      .finally(() => setBusy(''))
  }, [id])

  // Voice: the interviewer reads each new question aloud; you can answer with the mic.
  // Before the first question, Bella introduces herself (the backend sends her greeting with it).
  const questionText = interview?.question?.question
  const introText = interview?.question?.intro || ''
  const preface = useMemo(() => (introText ? [{ text: introText, voice: '' }] : NO_PREFACE), [introText])
  const voice = useInterviewVoice(questionText, interview?.mode, '', preface)

  // Text mode: put the cursor in the answer box whenever a new question appears.
  // (Not in voice mode: focusing would scroll the page away from the interviewer.)
  useEffect(() => {
    if (questionText && !voice.voiceOn) boxRef.current?.focus()
  }, [questionText, voice.voiceOn])

  // Runs one backend call, shows what is happening, and keeps the updated interview.
  async function run(kind, call) {
    setBusy(kind)
    setError('')
    try {
      const next = await call()
      setInterview(next)
      return next
    } catch (err) {
      // A 500 here usually means an AI step failed. LangGraph saved everything before it.
      if (err.status >= 500 && err.status < 502) {
        setError("That step didn't finish (the AI may be unavailable). Your answer is saved, so press Try again.")
      } else {
        setError(err.message)
      }
      return null
    } finally {
      setBusy('')
    }
  }

  // Sends the answer box, or the given text (the call's Skip button sends "I'm not sure...").
  // It is a live stream: the server says when each step of the graph starts and finishes.
  async function submit(text = answer.trim()) {
    if (!text || busy) return
    setLiveSteps([])
    const next = await run('grading', () => answerInterviewLive(id, text, onStep))
    if (next) setAnswer('')
  }

  // One live message: a step started (add it), or finished (tick it; steps here run one at a time).
  function onStep(name, data) {
    if (name === 'start') setLiveSteps((steps) => [...steps, { node: data.node, done: false }])
    if (name === 'finish') {
      setLiveSteps((steps) => steps.map((step, i) => (i === steps.length - 1 ? { ...step, done: true } : step)))
    }
  }

  async function retry() {
    const before = questionText
    const next = await run('retrying', () => retryInterview(id))
    // If the saved answer got graded on retry, a new question arrives, so clear the box.
    if (next && next.question?.question !== before) setAnswer('')
  }

  function end() {
    setConfirmEnd(false)
    run('ending', () => endInterview(id))
  }

  // Mic button: first click starts recording, second click stops it and adds your words to the answer box.
  async function toggleMic() {
    if (voice.mode === 'listening') {
      const spoken = await voice.stopListening()
      if (spoken) setAnswer((previous) => (previous.trim() ? `${previous.trim()} ${spoken}` : spoken))
      boxRef.current?.focus()
    } else {
      voice.startListening()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  if (missing) {
    return (
      <div className="page interview-page">
        <div className="card center-card">
          <h2>Interview not found</h2>
          <p className="muted">It may have been deleted.</p>
          <a className="button-link primary" href="#/interview">
            Start a new interview
          </a>
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="page interview-page">
        <div className="card center-card">
          {error ? (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <SpiderLoader label={BUSY_TEXT.loading} />
          )}
        </div>
      </div>
    )
  }

  if (interview.status === 'finished') return <InterviewReport interview={interview} />

  const q = interview.question
  const isBusy = Boolean(busy)
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const micBusy = voice.mode === 'listening' || voice.mode === 'transcribing'
  const endText =
    interview.answered === 0
      ? "You haven't answered anything yet, so the report will be empty."
      : `Your report will cover the ${plural(interview.answered, 'answer')} you have given so far.`

  const grading = busy === 'grading'
  const stepText = `${doingNow(liveSteps)}…`
  let finishedSteps = 0
  for (const step of liveSteps) if (step.done) finishedSteps += 1
  const xray = (
    <InterviewXray
      interviewId={id}
      open={xrayOpen}
      onClose={() => setXrayOpen(false)}
      running={grading ? liveSteps[liveSteps.length - 1]?.node || 'ask' : ''}
      refreshKey={`${interview.answered}-${q?.question}-${finishedSteps}`}
    />
  )

  const endDialog = (
    <ConfirmDialog
      open={confirmEnd}
      icon="flag"
      title="End the interview now?"
      text={endText}
      confirmLabel="End and see report"
      danger
      onConfirm={end}
      onCancel={() => setConfirmEnd(false)}
    />
  )

  if (voice.voiceOn) {
    return (
      <>
        <CallView
          interview={interview}
          details={settingsLine(interview)}
          voice={voice}
          answer={answer}
          setAnswer={setAnswer}
          busy={busy}
          stepText={stepText}
          error={error}
          onSubmit={submit}
          onXray={() => setXrayOpen(true)}
          onRetry={retry}
          onMic={toggleMic}
          onEnd={() => setConfirmEnd(true)}
        />
        {endDialog}
        {xray}
      </>
    )
  }

  return (
    <div className="page interview-page">
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Mock interview</div>
          <h1 className="topic-title">{interview.topic}</h1>
          <div className="muted small">{settingsLine(interview)}</div>
        </div>
        <div className="row">
          <FocusButton />
          <button onClick={() => setXrayOpen(true)} title="See every step the AI took, and why">
            <Icon name="eye" size={16} />
            X-ray
          </button>
          <button className="voice-toggle" onClick={voice.toggleVoice} title="Switch to a voice call with the 3D interviewer">
            <Icon name="mic" size={16} />
            Voice call
          </button>
          <button className="danger-outline" onClick={() => setConfirmEnd(true)} disabled={isBusy || micBusy}>
            <Icon name="flag" size={16} />
            End interview
          </button>
        </div>
      </header>

      {q && <QuestionSteps number={q.number} total={q.total} isFollowUp={q.is_follow_up} />}

      <section className="card question-card">
        {q ? (
          <>
            <div className="question-head">
              <span className="interviewer-badge spider-face">
                <SpiderArt />
              </span>
              <span className="interviewer-name">Bella</span>
              <span className={`chip${q.is_follow_up ? ' chip-follow' : ''}`}>
                {q.is_follow_up ? 'Follow-up on your answer' : `Question ${q.number} of ${q.total}`}
              </span>
            </div>
            {q.intro && <p className="question-intro">{q.intro}</p>}
            <p className="question-text">{q.question}</p>
            {grading && (
              <div className="question-status muted">
                <span className="typing">
                  <span />
                  <span />
                  <span />
                </span>
                {stepText}
                {liveSteps.length > 0 && <LiveSteps steps={liveSteps} />}
              </div>
            )}
          </>
        ) : (
          <div className="stalled">
            <Icon name="alert" size={20} />
            <div>
              <b>The last step didn't finish.</b>
              <p className="muted">The AI may have been unavailable. Your answer is saved, so nothing is lost.</p>
            </div>
            <button className="primary" onClick={retry} disabled={isBusy}>
              <Icon name="repeat" size={16} />
              Continue
            </button>
          </div>
        )}
      </section>

      {q && (
        <section className="card answer-card">
          <label className="field-label" htmlFor="answer">
            Your answer
          </label>
          <textarea
            id="answer"
            ref={boxRef}
            rows={6}
            maxLength={5000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy || micBusy}
            placeholder="Answer as you would in a real interview: explain the idea, then an example. Or press Answer by voice."
          />
          <div className="answer-foot">
            <div className="answer-tools">
              <button className={`mic-btn ${voice.mode}`} onClick={toggleMic} disabled={isBusy || voice.mode === 'transcribing'}>
                {voice.mode === 'listening' && (
                  <>
                    <span className="rec-dot" />
                    Stop · {voice.seconds}s
                  </>
                )}
                {voice.mode === 'transcribing' && (
                  <>
                    <span className="spinner small" />
                    Transcribing…
                  </>
                )}
                {voice.mode !== 'listening' && voice.mode !== 'transcribing' && (
                  <>
                    <Icon name="mic" size={16} />
                    Answer by voice
                  </>
                )}
              </button>
              <span className="muted small">
                {words} {words === 1 ? 'word' : 'words'} · <span className="kbd">⌘/Ctrl</span> + <span className="kbd">Enter</span> to submit
              </span>
            </div>
            <button className="primary" onClick={() => submit()} disabled={isBusy || micBusy || !answer.trim()}>
              {grading ? (
                <>
                  <span className="spinner small" />
                  Grading…
                </>
              ) : (
                <>
                  Submit answer
                  <Icon name="arrow" size={16} />
                </>
              )}
            </button>
          </div>
          {voice.voiceError && <p className="voice-error">{voice.voiceError}</p>}
        </section>
      )}

      {busy && busy !== 'grading' && (
        <p className="busy-note muted">
          <span className="spinner small" /> {BUSY_TEXT[busy]}
        </p>
      )}

      {error && (
        <div className="inline-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button className="small" onClick={retry} disabled={isBusy}>
            <Icon name="repeat" size={14} />
            Try again
          </button>
        </div>
      )}

      {endDialog}
      {xray}
    </div>
  )
}

// The steps of the graph so far, as they arrive: a tick when done, a spinner while running.
function LiveSteps({ steps }) {
  return (
    <div className="live-steps">
      {steps.map((step, i) => (
        <span key={i} className={`live-step${step.done ? ' done' : ''}`}>
          {step.done ? <Icon name="check" size={12} /> : <span className="spinner small" />}
          {STEP_NAMES[step.node] || step.node}
        </span>
      ))}
    </div>
  )
}

// A numbered dot for every main question: done ones get a tick, the current one is highlighted.
function QuestionSteps({ number, total, isFollowUp }) {
  const steps = []
  for (let n = 1; n <= total; n++) {
    let state = 'todo'
    if (n < number) state = 'done'
    if (n === number) state = 'now'
    steps.push(
      <span key={n} className={`step-dot ${state}`}>
        {state === 'done' ? <Icon name="check" size={13} /> : n}
      </span>,
    )
  }

  return (
    <div className="question-steps">
      <div className="step-dots">{steps}</div>
      <span className="muted small">
        {isFollowUp ? `Follow-up on question ${number}` : `Question ${number} of ${total}`}
      </span>
    </div>
  )
}
