import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { finishWhiteboard, getWhiteboard, reviewWhiteboard, saveWhiteboardScene } from '../../lib/api'
import { useInterviewVoice } from '../../lib/useInterviewVoice'
import ConfirmDialog from '../ConfirmDialog'
import FocusButton from '../focus/FocusButton'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import InterviewerPanel from './InterviewerPanel'
import WhiteboardReport from './WhiteboardReport'

const Board = lazy(() => import('./Board')) // Excalidraw is large: load it only on this screen

const QUIET_SECONDS = 25 // Bella looks once you have stopped drawing for this long after a change...
const MIN_GAP_SECONDS = 30 // ...and never more often than this
const SAVE_DELAY_MS = 3000 // the drawing is saved this long after your last change

// #/whiteboard/<id>: a system design round. You draw on the left; Bella, the 3D interviewer, watches on the
// right, looks at the board when you pause, speaks her feedback and pins notes on the board.
// When the round is finished, this shows the report instead.
export default function WhiteboardSession({ id }) {
  const [session, setSession] = useState(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState('') // '' | 'reviewing' | 'finishing'
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('') // what you are typing to Bella
  const [sending, setSending] = useState('') // what you just said, shown at once while Bella answers
  const [autoReview, setAutoReview] = useState(true)
  const [changed, setChanged] = useState(false) // you changed the board since Bella last looked
  const [lastChangeAt, setLastChangeAt] = useState(0)
  const [lastReviewAt, setLastReviewAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const boardRef = useRef(null) // the board's actions (see Board.jsx)
  const saveTimer = useRef(null)
  const autoRef = useRef(null) // what the 1-second timer should do now (always the latest)

  useEffect(() => {
    getWhiteboard(id)
      .then(setSession)
      .catch((err) => (err.status === 404 ? setMissing(true) : setError(err.message)))
  }, [id])

  // Bella speaks each new thing she says.
  const messages = useMemo(() => session?.messages || [], [session])
  const lastSaid = [...messages].reverse().find((m) => m.role === 'interviewer')?.text
  const voice = useInterviewVoice(lastSaid, 'voice')

  // ---------------------------------------------------------------- saving and reviewing

  // Saves the drawing now (a failed save is retried with the next change, so it is not reported).
  const saveBoard = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    const board = boardRef.current
    if (board) saveWhiteboardScene(id, { elements: board.shapes() }).catch(() => {})
  }, [id])

  // Stable handlers for the board, so the (memoised) board does not re-render every second.
  const handleReady = useCallback((board) => {
    boardRef.current = board
  }, [])
  const handleYourChange = useCallback(() => {
    setChanged(true)
    setLastChangeAt(Date.now())
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(saveBoard, SAVE_DELAY_MS)
  }, [saveBoard])

  // Leaving the page: save at once if a save was waiting.
  useEffect(() => {
    return () => {
      if (saveTimer.current) saveBoard()
    }
  }, [saveBoard])

  // Bella looks at the board. spoken = what you just said to her, if anything.
  async function review(spoken = '') {
    const board = boardRef.current
    if (!board || busy) return
    setBusy('reviewing')
    setSending(spoken)
    setError('')
    setChanged(false)
    setLastReviewAt(Date.now())
    try {
      const image = await board.picture()
      const result = await reviewWhiteboard(id, { scene: { elements: board.shapes() }, image, reply: spoken })
      board.showNotes(result.notes)
      saveBoard() // so Bella's notes are still there after a reload
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
    const board = boardRef.current
    if (!board) return
    saveBoard()
    setBusy('finishing')
    setError('')
    try {
      const image = await board.picture()
      setSession(await finishWhiteboard(id, { scene: { elements: board.shapes() }, image }))
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
  const canAutoReview = autoReview && changed && !busy && voice.mode === 'idle' && !draft.trim()

  useEffect(() => {
    autoRef.current = canAutoReview && secondsLeft === 0 ? () => review() : null
  })

  // Every second: update the countdown, and let Bella look when it reaches zero.
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
          <h2>Whiteboard round not found</h2>
          <a className="button-link primary" href="#/whiteboard">
            Start a new one
          </a>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="page">
        {error ? <p className="muted">{error}</p> : <SpiderLoader size="large" label="Loading the whiteboard…" />}
      </div>
    )
  }

  if (session.status === 'finished') return <WhiteboardReport session={session} />

  let watch = <>Watching your board</>
  if (changed && autoReview) watch = <>Bella looks in {secondsLeft}s</>
  if (changed && !autoReview) watch = <>Changed since Bella looked</>
  if (busy === 'reviewing') watch = <>Bella is looking…</>

  return (
    <div className="wb">
      <header className="wb-top">
        <a className="call-back" href="#/whiteboard" title="Leave. Your board is saved, so you can continue later.">
          <Icon name="back" size={18} />
        </a>
        <span className="wb-badge">
          <Icon name="pen" size={16} />
        </span>
        <div className="wb-title">
          <b>{session.question}</b>
          <span className="muted">{session.brief}</span>
        </div>
        <span className={`wb-watch${changed ? ' changed' : ''}${busy === 'reviewing' ? ' looking' : ''}`}>
          <Icon name="eye" size={14} />
          {watch}
        </span>
        <label className="wb-switch" title="Bella looks by herself when you pause">
          <input type="checkbox" checked={autoReview} onChange={(e) => setAutoReview(e.target.checked)} />
          Auto
        </label>
        <FocusButton />
        <button onClick={() => review()} disabled={Boolean(busy)}>
          <Icon name="eye" size={15} />
          Review now
        </button>
        <button onClick={() => boardRef.current?.clearNotes()} title="Remove Bella's notes from the board">
          <Icon name="x" size={15} />
          Clear notes
        </button>
        <button className="primary" onClick={() => setConfirmFinish(true)} disabled={Boolean(busy)}>
          <Icon name="flag" size={15} />
          Finish
        </button>
      </header>

      <main className="wb-main">
        <section className={`wb-board${busy === 'reviewing' ? ' looking' : ''}`}>
          <Suspense
            fallback={
              <div className="wb-loading">
                <SpiderLoader size="large" label="Setting up the whiteboard…" />
              </div>
            }
          >
            <Board initialShapes={session.scene.elements} onReady={handleReady} onYourChange={handleYourChange} />
          </Suspense>
        </section>

        <InterviewerPanel
          messages={sending ? [...messages, { role: 'candidate', text: sending }] : messages}
          voice={voice}
          looking={busy === 'reviewing'}
          disabled={busy === 'finishing'}
          draft={draft}
          setDraft={setDraft}
          onSend={(text) => review(text)}
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
        title="Finish and get your report?"
        text="Bella will grade your design on requirements, components, data flow, storage, scaling, reliability and trade-offs."
        confirmLabel="Finish and grade"
        onConfirm={finish}
        onCancel={() => setConfirmFinish(false)}
      />

      {busy === 'finishing' && (
        <div className="call-overlay">
          <SpiderLoader size="large" label="Bella is grading your design…" />
        </div>
      )}
    </div>
  )
}
