import { useEffect, useRef, useState } from 'react'
import { estimateMinutes } from '../../lib/format'
import { stopSpeaking } from '../../lib/voice'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import SpokenCaption from '../SpokenCaption'
import InterviewerAvatar from './InterviewerAvatar'

// Who the 3D interviewer is. Change it here: it shows on the name tag and in the captions.
const INTERVIEWER = { name: 'Bella', title: 'Senior Engineer' }

// What "Skip" sends: an honest "I don't know", so the interview moves on (it scores as not answered).
const SKIP_ANSWER = "I'm not sure about this one. Can we move on to the next question?"

// 75 -> "01:15"
function clock(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

// Voice mode, laid out like a video call: the interviewer fills the screen, with captions,
// your camera in the corner and call controls at the bottom. Like a real interview, it does
// not show question numbers. InterviewSession owns the interview; this is only the screen.
//   details   "Medium · up to 1 follow-up"
//   voice     everything from useInterviewVoice()
//   stepText  what the interviewer is doing while your answer is graded ("Grading your answer…")
//   onSubmit  sends the answer box, or the text it is given (Skip)
//   onMic     first press starts recording, second press stops it and puts the words in the answer box
//   onEnd     asks "End the interview now?"
//   onXray    opens the Interview X-ray
export default function CallView({
  interview,
  details,
  voice,
  answer,
  setAnswer,
  busy,
  stepText,
  error,
  onSubmit,
  onRetry,
  onMic,
  onEnd,
  onXray,
}) {
  const [captions, setCaptions] = useState(true)
  const [camera, setCamera] = useState(false) // off until you turn it on; the video never leaves the browser
  const [cameraError, setCameraError] = useState('')
  const [typing, setTyping] = useState(false) // the answer box is open
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds in this call
  const videoRef = useRef(null)
  const draftRef = useRef(null)
  const spaceRef = useRef(null) // what the Space key does right now

  const q = interview.question
  const isBusy = Boolean(busy)
  const listening = voice.mode === 'listening'
  const transcribing = voice.mode === 'transcribing'
  const speaking = voice.mode === 'speaking'
  const hasDraft = Boolean(answer.trim())
  const canTalk = Boolean(q) && !isBusy && !paused && !transcribing
  const canSend = canTalk && !listening
  const avatarMode = busy === 'grading' ? 'thinking' : voice.mode
  const planned = estimateMinutes(interview.num_questions, interview.max_follow_ups) * 60

  // The clock, stopped while paused.
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [paused])

  // Your camera in the corner, only while it is on.
  useEffect(() => {
    if (!camera) return
    let stream = null
    let gone = false
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        stream = s
        if (gone) s.getTracks().forEach((track) => track.stop())
        else if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => {
        if (gone) return
        setCamera(false)
        setCameraError('The camera is not available.')
      })
    return () => {
      gone = true
      stream?.getTracks().forEach((track) => track.stop()) // turns the camera light off
    }
  }, [camera])

  // Opening the answer box puts the cursor in it.
  useEffect(() => {
    if (typing) draftRef.current?.focus()
  }, [typing])

  // Space = push to talk (not while typing in the answer box, or while a dialog is open).
  useEffect(() => {
    spaceRef.current = canTalk ? onMic : null
  })
  useEffect(() => {
    const inTextBox = (e) => e.target.closest('textarea, input')
    function onKeyDown(e) {
      if (e.code !== 'Space' || inTextBox(e) || document.querySelector('dialog[open]')) return
      e.preventDefault() // otherwise Space would also press the last button you clicked
      if (!e.repeat) spaceRef.current?.()
    }
    function onKeyUp(e) {
      if (e.code === 'Space' && !inTextBox(e)) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  function pause() {
    stopSpeaking()
    setPaused(true)
  }

  function toggleCamera() {
    setCameraError('')
    setCamera(!camera)
  }

  function handleDraftKeys(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  const kbd = <span className="kbd">Space</span>
  let status = (
    <>
      <b>Your turn</b> · press {kbd} and speak
    </>
  )
  if (hasDraft) status = <><b>Check your answer</b> · fix any wrong words, then Send</>
  if (speaking) status = <><b>{INTERVIEWER.name}</b> is speaking · press {kbd} to answer</>
  if (transcribing) status = <>Got it…</>
  if (listening) status = <><span className="rec-light" /><b>Listening</b> · press {kbd} when you finish</>
  if (busy === 'grading') status = <><b>{INTERVIEWER.name}</b> · {stepText}</>
  if (busy === 'retrying' || busy === 'ending') status = <>One moment…</>
  if (!q) status = <><b>The last step didn't finish</b> · nothing is lost</>

  let you = answer
  if (listening) you = 'listening…'
  if (transcribing) you = '…'

  return (
    <div className="call">
      <header className="call-top">
        <a className="call-back" href="#/interview/past" title="Leave the call. The interview stays saved, so you can continue later.">
          <Icon name="back" size={18} />
        </a>
        <span className="live-dot" />
        <div className="call-title">
          {interview.topic}
          <span className="muted"> · {details}</span>
        </div>
        <button className="small" onClick={onXray} title="See every step the AI took, and why">
          <Icon name="eye" size={15} />
          X-ray
        </button>
        <button className="small" onClick={voice.toggleVoice} title="Switch to the text screen">
          <Icon name="keyboard" size={15} />
          Text mode
        </button>
        <div className={`call-timer${elapsed > planned ? ' over' : ''}`} title="Time in this call / planned length">
          {clock(elapsed)} / {clock(planned)}
        </div>
      </header>

      <main className="call-main">
        <section className="call-stage office">
          <InterviewerAvatar mode={avatarMode} level={voice.level} name={INTERVIEWER.name} />

          <div className="ai-badge">AI interviewer · AI-generated voice</div>
          <div className="nameplate">
            <span className={`eq${speaking ? ' on' : ''}`}>
              <i />
              <i />
              <i />
            </span>
            {INTERVIEWER.name} · {INTERVIEWER.title}
          </div>

          {busy === 'grading' && (
            <div className="think-bubble">
              <span />
              <span />
              <span />
            </div>
          )}

          {voice.needsClick && (
            <button className="primary big stage-play" onClick={voice.replay}>
              <Icon name="play" size={16} />
              Hear the question
            </button>
          )}

          {!q && (
            <div className="card call-stalled">
              <Icon name="alert" size={20} />
              <div>
                <b>The last step didn't finish.</b>
                <p className="muted">The AI may have been unavailable. Your answer is saved.</p>
                <button className="primary" onClick={onRetry} disabled={isBusy}>
                  <Icon name="repeat" size={16} />
                  Continue
                </button>
              </div>
            </div>
          )}

          {captions && q && (
            <div className="captions">
              <div className={`caption${listening ? ' dim' : ''}`}>
                <b>{INTERVIEWER.name}:</b> <SpokenCaption key={q.question} text={q.question} voice={voice} />
              </div>
              {you && (
                <div className="caption me">
                  <b>You:</b> {you}
                </div>
              )}
            </div>
          )}

          <div
            className="selfview"
            style={listening ? { boxShadow: `0 0 0 ${2 + Math.round(voice.level * 6)}px rgba(34, 197, 94, 0.75)` } : undefined}
          >
            {camera ? <video ref={videoRef} autoPlay muted playsInline className="mirror" /> : <div className="me-initial">You</div>}
            <span className="self-label">You</span>
          </div>
        </section>
      </main>

      <div className="call-status">
        <div className="status-pill">{status}</div>
        {(error || voice.voiceError || cameraError) && (
          <div className="call-error" role="alert">
            <Icon name="alert" size={15} />
            {error || voice.voiceError || cameraError}
            {error && (
              <button className="small" onClick={onRetry} disabled={isBusy}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {q && (typing || hasDraft) && (
        <div className="type-dock">
          <textarea
            ref={draftRef}
            rows={3}
            maxLength={5000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleDraftKeys}
            disabled={!canSend}
            placeholder="Type your answer, or fix the words from your voice. Ctrl/⌘ + Enter to send."
          />
          <div className="dock-actions">
            <button className="primary" onClick={() => onSubmit()} disabled={!canSend || !hasDraft}>
              Send
              <Icon name="arrow" size={16} />
            </button>
            <button onClick={() => setAnswer('')} disabled={!canSend || !hasDraft}>
              Clear
            </button>
          </div>
        </div>
      )}

      <footer className="call-controls">
        <button className={`mic-main${listening ? ' rec' : ''}`} onClick={onMic} disabled={!canTalk} title="Space">
          {transcribing && <span className="spinner small" />}
          {!transcribing && <Icon name={listening ? 'stop' : 'mic'} size={20} />}
          {listening ? 'Done' : 'Answer'}
        </button>
        <button className="round-btn" onClick={pause} disabled={!q || isBusy || listening || transcribing} title="Pause">
          <Icon name="pause" />
        </button>
        <button className={`round-btn${camera ? '' : ' off'}`} onClick={toggleCamera} title={camera ? 'Turn camera off' : 'Turn camera on'}>
          <Icon name={camera ? 'cam' : 'camoff'} />
        </button>
        <button className={`round-btn${captions ? ' on' : ''}`} onClick={() => setCaptions(!captions)} title="Captions">
          <Icon name="cc" />
        </button>
        <button
          className="round-btn"
          onClick={voice.replay}
          disabled={!q || voice.mode !== 'idle' || isBusy || paused}
          title="Hear the question again"
        >
          <Icon name="repeat" />
        </button>
        <button
          className="round-btn"
          onClick={() => onSubmit(SKIP_ANSWER)}
          disabled={!canSend || voice.mode !== 'idle'}
          title="Skip this question (it counts as not answered)"
        >
          <Icon name="skip" />
        </button>
        <button className={`round-btn${typing ? ' on' : ''}`} onClick={() => setTyping(!typing)} title="Type your answer">
          <Icon name="keyboard" />
        </button>
        <button className="leave" onClick={onEnd} disabled={isBusy || listening || transcribing}>
          <Icon name="leave" size={20} />
          End
        </button>
      </footer>

      {paused && (
        <div className="call-overlay">
          <div className="card pause-card">
            <span className="pause-icon">
              <Icon name="pause" size={24} />
            </span>
            <h2>Interview paused</h2>
            <p className="muted">
              The clock is stopped at <b>{clock(elapsed)}</b>. Your answers so far are saved.
            </p>
            <button className="primary big" onClick={() => setPaused(false)}>
              <Icon name="play" size={16} />
              Resume
            </button>
          </div>
        </div>
      )}

      {busy === 'ending' && (
        <div className="call-overlay">
          <SpiderLoader size="large" label="Writing your report…" />
        </div>
      )}
    </div>
  )
}
