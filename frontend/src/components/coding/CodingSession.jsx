import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { finishCodingRound, getCodingRound, reviewCode, saveCode } from '../../lib/api'
import { runTests, warmUpPython } from '../../lib/python'
import { useInterviewVoice } from '../../lib/useInterviewVoice'
import ConfirmDialog from '../ConfirmDialog'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import InterviewerPanel from '../whiteboard/InterviewerPanel'
import CodingReport from './CodingReport'
import ProblemPane from './ProblemPane'
import TestResults from './TestResults'

const CodeEditor = lazy(() => import('./CodeEditor')) // the editor loads only on this screen

const QUIET_SECONDS = 25 // Bella reads your code once you have stopped typing for this long after a change...
const MIN_GAP_SECONDS = 30 // ...and never more often than this
const SAVE_DELAY_MS = 3000 // the code is saved this long after your last change

// #/coding/<id>: a coding round. The problem on the left, your code in the middle, Bella on the right.
// Your code runs in your browser (lib/python.js); Bella reads it when you pause, speaks, and pins notes
// to lines. When the round is finished, this shows the report instead.
export default function CodingSession({ id }) {
  const [session, setSession] = useState(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState('') // '' | 'reviewing' | 'finishing'
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('') // what you are typing to Bella
  const [sending, setSending] = useState('') // what you just said, shown at once while Bella answers
  const [notes, setNotes] = useState([]) // Bella's latest notes on lines of your code
  const [run, setRun] = useState(null) // the latest test run: { results, error }
  const [testStatus, setTestStatus] = useState('') // '' | 'loading' | 'running'
  const [autoReview, setAutoReview] = useState(true)
  const [changed, setChanged] = useState(false) // you changed the code since Bella last read it
  const [lastChangeAt, setLastChangeAt] = useState(0)
  const [lastReviewAt, setLastReviewAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const codeRef = useRef('') // the latest code (kept in a ref: it changes on every key press)
  const editorRef = useRef(null) // the editor's actions (see CodeEditor.jsx)
  const saveTimer = useRef(null)
  const autoRef = useRef(null) // what the 1-second timer should do now (always the latest)

  useEffect(() => {
    getCodingRound(id)
      .then((data) => {
        codeRef.current = data.code
        setSession(data)
      })
      .catch((err) => (err.status === 404 ? setMissing(true) : setError(err.message)))
    warmUpPython().catch(() => {}) // start loading Python now, so the first Run is quick
  }, [id])

  // Bella speaks each new thing she says.
  const messages = useMemo(() => session?.messages || [], [session])
  const lastSaid = [...messages].reverse().find((m) => m.role === 'interviewer')?.text
  const voice = useInterviewVoice(lastSaid, 'voice')

  // ---------------------------------------------------------------- saving

  // Saves the code now (a failed save is retried with the next change, so it is not reported).
  const saveNow = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    saveCode(id, codeRef.current).catch(() => {})
  }, [id])

  const handleChange = useCallback(
    (code) => {
      codeRef.current = code
      setChanged(true)
      setLastChangeAt(Date.now())
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(saveNow, SAVE_DELAY_MS)
    },
    [saveNow],
  )

  const handleEditorReady = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  // Leaving the page: save at once if a save was waiting.
  useEffect(() => {
    return () => {
      if (saveTimer.current) saveNow()
    }
  }, [saveNow])

  // ---------------------------------------------------------------- tests

  async function runVisibleTests() {
    if (testStatus) return null
    setTestStatus('loading')
    setError('')
    try {
      await warmUpPython()
      setTestStatus('running')
      const result = await runTests(session.problem, codeRef.current, { onProgress: (results) => setRun({ results }) })
      setRun(result)
      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setTestStatus('')
    }
  }

  // ---------------------------------------------------------------- Bella

  // Bella reads the code. spoken = what you just said to her; hint = you asked for a hint.
  async function review({ spoken = '', hint = false } = {}) {
    if (busy) return
    setBusy('reviewing')
    setSending(spoken || (hint ? 'Can I get a hint?' : ''))
    setError('')
    setChanged(false)
    setLastReviewAt(Date.now())
    try {
      const result = await reviewCode(id, { code: codeRef.current, results: run?.results || [], reply: spoken, hint })
      setNotes(result.notes)
      setSession(result.session)
    } catch (err) {
      setError(err.message)
      if (spoken) setDraft(spoken) // give your words back, so you can send them again
    } finally {
      setSending('')
      setBusy('')
    }
  }

  async function finish() {
    setConfirmFinish(false)
    saveNow()
    setBusy('finishing')
    setError('')
    try {
      await warmUpPython()
      const final = await runTests(session.problem, codeRef.current, { includeHidden: true })
      setSession(await finishCodingRound(id, { code: codeRef.current, results: final.results }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  // ---------------------------------------------------------------- the automatic review

  const quietFor = (now - lastChangeAt) / 1000
  const sinceReview = (now - lastReviewAt) / 1000
  const secondsLeft = Math.ceil(Math.max(QUIET_SECONDS - quietFor, MIN_GAP_SECONDS - sinceReview, 0))
  const canAutoReview = autoReview && changed && !busy && !testStatus && voice.mode === 'idle' && !draft.trim()

  useEffect(() => {
    autoRef.current = canAutoReview && secondsLeft === 0 ? () => review() : null
  })

  // Every second: update the countdown, and let Bella read the code when it reaches zero.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      autoRef.current?.()
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ---------------------------------------------------------------- screens

  if (missing) {
    return (
      <div className="page">
        <div className="card center-card">
          <h2>Coding round not found</h2>
          <a className="button-link primary" href="#/coding">
            Start a new one
          </a>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="page">
        {error ? <p className="muted">{error}</p> : <SpiderLoader size="large" label="Loading the problem…" />}
      </div>
    )
  }

  if (session.status === 'finished') return <CodingReport session={session} />

  const practice = session.mode === 'practice'
  let watch = <>Watching your code</>
  if (changed && autoReview) watch = <>Bella reads in {secondsLeft}s</>
  if (changed && !autoReview) watch = <>Changed since Bella read it</>
  if (busy === 'reviewing') watch = <>Bella is reading…</>

  return (
    <div className="wb code-round">
      <header className="wb-top">
        <a className="call-back" href="#/coding" title="Leave. Your code is saved, so you can continue later.">
          <Icon name="back" size={18} />
        </a>
        <span className="wb-badge">
          <Icon name="code" size={16} />
        </span>
        <div className="wb-title">
          <b>{session.problem.title}</b>
          <span className="muted">
            {practice ? 'Practice mode: Bella coaches you, hints are free' : 'Interview mode: Bella only asks, each hint costs 0.5'}
          </span>
        </div>
        <span className={`code-mode ${session.mode}`}>{practice ? 'Practice' : 'Interview'}</span>
        <span className={`wb-watch${changed ? ' changed' : ''}${busy === 'reviewing' ? ' looking' : ''}`}>
          <Icon name="eye" size={14} />
          {watch}
        </span>
        <label className="wb-switch" title="Bella reads your code by herself when you pause">
          <input type="checkbox" checked={autoReview} onChange={(e) => setAutoReview(e.target.checked)} />
          Auto
        </label>
        <button onClick={() => review({ hint: true })} disabled={Boolean(busy)} title={practice ? 'Free in practice mode' : 'Costs 0.5 points'}>
          <Icon name="sparkle" size={15} />
          Hint{session.hints_used > 0 && ` (${session.hints_used})`}
        </button>
        <button onClick={runVisibleTests} disabled={Boolean(testStatus) || busy === 'finishing'}>
          <Icon name="play" size={15} />
          Run
        </button>
        <button className="primary" onClick={() => setConfirmFinish(true)} disabled={Boolean(busy) || Boolean(testStatus)}>
          <Icon name="flag" size={15} />
          Submit
        </button>
      </header>

      <main className="code-main">
        <ProblemPane problem={session.problem} />

        <section className={`code-work${busy === 'reviewing' ? ' looking' : ''}`}>
          {notes.length > 0 && (
            <div className="code-notes">
              {notes.map((note) => (
                <button key={`${note.line}-${note.text}`} className="code-note" onClick={() => editorRef.current?.jumpTo(note.line)}>
                  <span>Line {note.line}</span>
                  {note.text}
                </button>
              ))}
            </div>
          )}
          <div className="code-editor-box">
            <Suspense fallback={<SpiderLoader label="Opening the editor…" />}>
              <CodeEditor initialCode={session.code} notes={notes} onReady={handleEditorReady} onChange={handleChange} />
            </Suspense>
          </div>
          <TestResults run={run} status={testStatus} />
        </section>

        <InterviewerPanel
          messages={sending ? [...messages, { role: 'candidate', text: sending }] : messages}
          voice={voice}
          looking={busy === 'reviewing'}
          lookingLabel="Reading your code"
          disabled={busy === 'finishing'}
          draft={draft}
          setDraft={setDraft}
          onSend={(text) => review({ spoken: text })}
        />
      </main>

      {error && (
        <div className="call-error wb-error" role="alert">
          <Icon name="alert" size={15} />
          {error}
          <button className="small" onClick={() => setError('')}>
            Close
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmFinish}
        icon="flag"
        title="Submit your solution?"
        text="All the tests run, including the hidden ones and the big input. Then Bella grades your solution."
        confirmLabel="Submit and grade"
        onConfirm={finish}
        onCancel={() => setConfirmFinish(false)}
      />

      {busy === 'finishing' && (
        <div className="call-overlay">
          <SpiderLoader size="large" label="Running all the tests, then Bella grades…" />
        </div>
      )}
    </div>
  )
}
