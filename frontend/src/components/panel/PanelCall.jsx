import { useEffect, useRef, useState } from 'react'
import { lookOf } from '../../lib/agents'
import FocusButton from '../focus/FocusButton'
import Icon from '../Icon'
import SpiderLoader, { SpiderArt } from '../SpiderLoader'
import SpokenCaption from '../SpokenCaption'
import { doingNow, nameOf, TILE_STATUS } from './steps'

// 75 -> "01:15"
function clock(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

// The panel interview as a video call, laid out like Google Meet: one tile per panelist and one for you.
// The panelist who asks speaks in their own voice; their tile lights up while they talk, with captions.
// You answer with Space (push to talk), check the words, then Send. PanelSession owns the data; this draws.
//   voice   useInterviewVoice() with the asking panelist's voice
//   steps   the live steps while your answer is handled: [{ id, node, who, done }]
export default function PanelCall({ panel, voice, answer, setAnswer, busy, steps, error, onSubmit, onMic, onRetry, onEnd }) {
  const [captions, setCaptions] = useState(true)
  const [camera, setCamera] = useState(false) // off until you turn it on; the video never leaves the browser
  const [cameraError, setCameraError] = useState('')
  const [typing, setTyping] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const videoRef = useRef(null)
  const draftRef = useRef(null)
  const spaceRef = useRef(null) // what the Space key does right now

  const q = panel.question
  const isBusy = Boolean(busy)
  const answering = busy === 'answering'
  const listening = voice.mode === 'listening'
  const transcribing = voice.mode === 'transcribing'
  const speaking = voice.mode === 'speaking'
  const hasDraft = Boolean(answer.trim())
  const canTalk = Boolean(q) && !isBusy && !transcribing
  const canSend = canTalk && !listening
  const asker = q ? nameOf(panel.panel, q.speaker) : ''
  // During the round of introductions, the line being said is one of panel.intros: that panelist is talking.
  const introLine = (panel.intros || []).find((line) => line.text === voice.speech?.text)
  const talkingId = introLine ? introLine.speaker : q?.speaker
  const talker = introLine ? nameOf(panel.panel, introLine.speaker) : asker
  const captionLine = introLine ? introLine.text : q?.question
  const firstTurn = panel.answered === 0 && panel.transcript.length === 0
  // still introducing themselves: the first question hasn't started yet (steady between two introductions)
  const introsPending = firstTurn && Boolean(q) && voice.voiceOn && voice.said !== q.question && voice.speech?.text !== q.question

  // the call clock
  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // your camera, only while it is on
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

  useEffect(() => {
    if (typing) draftRef.current?.focus()
  }, [typing])

  // Space = push to talk (not while typing in a box, or while a dialog is open)
  useEffect(() => {
    spaceRef.current = canTalk ? onMic : null
  })
  useEffect(() => {
    const inTextBox = (e) => e.target.closest('textarea, input')
    function onKeyDown(e) {
      if (e.code !== 'Space' || inTextBox(e) || document.querySelector('dialog[open]')) return
      e.preventDefault()
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

  function handleDraftKeys(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  const kbd = <span className="kbd">Space</span>
  let status = (
    <>
      <b>Your turn</b> · press {kbd} and answer {asker}
    </>
  )
  if (hasDraft)
    status = (
      <>
        <b>Check your answer</b> · fix any wrong words, then Send
      </>
    )
  if (speaking && introLine)
    status = (
      <>
        <b>Introductions</b> · {talker}
      </>
    )
  if (speaking && !introLine)
    status = (
      <>
        <b>{asker}</b> is speaking · press {kbd} to answer
      </>
    )
  if (transcribing) status = <>Got it…</>
  if (listening)
    status = (
      <>
        <span className="rec-light" />
        <b>Listening</b> · press {kbd} when you finish
      </>
    )
  if (answering) status = <>{doingNow(steps, panel.panel)}</>
  if (busy === 'retrying' || busy === 'ending') status = <>One moment…</>
  if (!q && !answering)
    status = (
      <>
        <b>The last step didn't finish</b> · nothing is lost
      </>
    )

  let you = answer
  if (listening) you = 'listening…'
  if (transcribing) you = '…'

  const tiles = panel.panel.length + 1 // the panelists, and you

  return (
    <div className="call panel-call">
      <header className="call-top">
        <a className="call-back" href="#/panel/past" title="Leave the call. The panel stays saved, so you can continue later.">
          <Icon name="back" size={18} />
        </a>
        <span className="live-dot" />
        <div className="call-title">
          {panel.title}
          <span className="muted"> · Panel interview{q ? ` · question ${q.number} of ${q.total}` : ''}</span>
        </div>
        <FocusButton small />
        <button
          className={`small${showNotes ? ' notes-on' : ''}`}
          onClick={() => setShowNotes(!showNotes)}
          title="The private notes the panelists pass to each other"
        >
          <Icon name="eye" size={15} />
          {showNotes ? 'Hide notes' : 'Panel notes'}
        </button>
        <button className="small" onClick={voice.toggleVoice} title="Switch to the text screen">
          <Icon name="keyboard" size={15} />
          Text mode
        </button>
        <div className="call-timer" title="Time in this call">
          {clock(elapsed)}
        </div>
      </header>

      <main className="call-main">
        <section className="call-stage panel-call-stage">
          <div className={`panel-grid tiles-${tiles}`}>
            {panel.panel.map((panelist) => (
              <CallTile
                key={panelist.id}
                panelist={panelist}
                speaking={speaking && talkingId === panelist.id}
                asking={!answering && !introsPending && q?.speaker === panelist.id}
                level={voice.level}
                steps={steps}
              />
            ))}

            <div className={`call-tile you-tile${listening ? ' speaking' : ''}`}>
              {camera ? (
                <video ref={videoRef} autoPlay muted playsInline className="mirror" />
              ) : (
                <span
                  className="you-face"
                  style={
                    listening
                      ? {
                          boxShadow: `0 0 0 ${4 + Math.round(voice.level * 14)}px rgba(34, 197, 94, 0.45)`,
                        }
                      : undefined
                  }
                >
                  You
                </span>
              )}
              <span className="tile-name">
                <span className={`eq${listening ? ' on' : ''}`}>
                  <i />
                  <i />
                  <i />
                </span>
                You
              </span>
            </div>
          </div>

          {/* captions get their own strip under the tiles, so they never cover a face or a name */}
          {captions && (
            <div className="captions">
              {q && !answering && !introLine && q.kind === 'follow_up' && q.reason && (
                <div className="caption why">
                  {asker} follows up: {q.reason}
                </div>
              )}
              {q && !answering && (
                <div className={`caption${listening ? ' dim' : ''}`}>
                  <b>{talker}:</b> <SpokenCaption key={captionLine} text={captionLine} voice={voice} />
                </div>
              )}
              {q && !answering && you && (
                <div className="caption me">
                  <b>You:</b> {you}
                </div>
              )}
            </div>
          )}

          {voice.needsClick && (
            <button className="primary big stage-play" onClick={voice.replayAll}>
              <Icon name="play" size={16} />
              {firstTurn ? 'Meet the panel' : `Hear ${asker}`}
            </button>
          )}

          {!q && !answering && (
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

          {showNotes && <CallNotes panel={panel} />}
        </section>
      </main>

      <div className="call-status">
        <div className="status-row">
          <div className="status-pill">{status}</div>
          {introsPending && (
            <button className="small" onClick={voice.replay} title="Skip the introductions and hear the first question">
              <Icon name="skip" size={14} />
              Skip introductions
            </button>
          )}
        </div>
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
        <button
          className={`round-btn${camera ? '' : ' off'}`}
          onClick={() => {
            setCameraError('')
            setCamera(!camera)
          }}
          title={camera ? 'Turn camera off' : 'Turn camera on'}
        >
          <Icon name={camera ? 'cam' : 'camoff'} />
        </button>
        <button className={`round-btn${captions ? ' on' : ''}`} onClick={() => setCaptions(!captions)} title="Captions">
          <Icon name="cc" />
        </button>
        <button
          className="round-btn"
          onClick={voice.replay}
          disabled={!q || voice.mode !== 'idle' || isBusy}
          title="Hear the question again"
        >
          <Icon name="repeat" />
        </button>
        <button className={`round-btn${typing ? ' on' : ''}`} onClick={() => setTyping(!typing)} title="Type your answer">
          <Icon name="keyboard" />
        </button>
        <button className="leave" onClick={onEnd} disabled={isBusy || listening || transcribing}>
          <Icon name="leave" size={20} />
          End
        </button>
      </footer>

      {busy === 'ending' && (
        <div className="call-overlay">
          <SpiderLoader size="large" label="The panel is deciding…" />
        </div>
      )}
    </div>
  )
}

// One panelist's tile: their spider in their own colour, a ring that grows with their voice while they speak,
// what they are doing while your answer is handled, and their name in the corner.
function CallTile({ panelist, speaking, asking, level, steps }) {
  const mine = steps.filter((step) => step.who === panelist.id)
  const running = mine.find((step) => !step.done)
  const wroteNote = mine.some((step) => step.node === 'listen' && step.done)
  const ring = speaking
    ? {
        boxShadow: `0 0 0 ${4 + Math.round(level * 16)}px color-mix(in srgb, var(--spider-color) 35%, transparent)`,
      }
    : undefined

  return (
    <div
      className={`call-tile${speaking ? ' speaking' : ''}${asking ? ' asking' : ''}`}
      style={{ '--spider-color': lookOf(panelist.id).color }}
    >
      <span className={`tile-face${speaking || running ? ' spider-alive' : ''}`} style={ring}>
        <SpiderArt talk={speaking ? level : 0} />
      </span>
      {asking && !speaking && <span className="tile-chip">Asking</span>}
      {running && (
        <span className="tile-chip">
          <span className="spinner small" />
          {TILE_STATUS[running.node] || 'Thinking…'}
        </span>
      )}
      {!running && wroteNote && (
        <span className="tile-chip done">
          <Icon name="check" size={12} />
          Note written
        </span>
      )}
      <span className="tile-name">
        <span className={`eq${speaking ? ' on' : ''}`}>
          <i />
          <i />
          <i />
        </span>
        {panelist.name} · {panelist.title}
      </span>
    </div>
  )
}

// The private notes about your latest answer, and what the chair decided: a drawer on the right of the call.
function CallNotes({ panel }) {
  const turn = panel.answered - 1
  const notes = panel.notes.filter((note) => note.turn === turn && note.note)
  const decision = panel.decisions.find((d) => d.turn === turn)
  return (
    <aside className="call-notes">
      <h3>
        <Icon name="eye" size={15} />
        The panel's notes
      </h3>
      {turn < 0 && <p className="muted small">After your first answer, each panelist writes a note here for the others.</p>}
      {notes.map((note) => (
        <div key={note.by} className="call-note" style={{ '--spider-color': lookOf(note.by).color }}>
          <b>{nameOf(panel.panel, note.by)}</b>
          <p>{note.note}</p>
          {note.follow_up && <p className="note-wish">Wants to ask: “{note.follow_up}”</p>}
        </div>
      ))}
      {decision && (
        <div className="call-note chair">
          <b>The chair</b>
          <p>
            {decision.action === 'follow_up' && `${nameOf(panel.panel, decision.speaker)} follows up. `}
            {decision.action === 'new_question' && `${nameOf(panel.panel, decision.speaker)} asks next. `}
            {decision.reason}
          </p>
        </div>
      )}
    </aside>
  )
}
