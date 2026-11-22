import { useEffect, useRef, useState } from 'react'
import AgentAvatar from '../bank/AgentAvatar'
import FocusButton from '../focus/FocusButton'
import Icon from '../Icon'
import { doingNow, nameOf, TILE_STATUS } from './steps'

const NOTES_KEY = 'spaider-panel-notes' // remembers "Show the panel's notes" in this browser

function notesWereShown() {
  try {
    return localStorage.getItem(NOTES_KEY) === 'on'
  } catch {
    return false
  }
}

// The panel interview while it runs: a tile per panelist (the one asking glows), the conversation, the
// current question and your answer box. PanelSession owns the data and the calls; this only draws.
//   steps     the live steps while your answer is handled: [{ id, node, who, done }]
//   voice     useInterviewVoice(), for "Answer by voice"
export default function PanelRoom({ panel, answer, setAnswer, boxRef, busy, busyText, steps, error, voice, onSubmit, onMic, onRetry, onEnd }) {
  const [showNotes, setShowNotes] = useState(notesWereShown)
  const chatEndRef = useRef(null)
  const q = panel.question
  const answering = busy === 'answering'
  const micBusy = voice.mode === 'listening' || voice.mode === 'transcribing'
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0

  // keep the newest line in view
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [panel.transcript.length, q?.question, answering])

  function toggleNotes() {
    const next = !showNotes
    setShowNotes(next)
    try {
      localStorage.setItem(NOTES_KEY, next ? 'on' : 'off')
    } catch {
      // private mode or blocked storage: it just won't be remembered
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="page interview-page panel-room">
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Panel interview</div>
          <h1 className="topic-title">{panel.title}</h1>
          <div className="muted small">
            {q ? `Question ${q.number} of ${q.total}` : `${panel.num_questions} questions`} · up to {panel.max_follow_ups} follow-up
            {panel.max_follow_ups === 1 ? '' : 's'} after each
          </div>
        </div>
        <div className="row">
          <FocusButton />
          <button className="voice-toggle" onClick={voice.toggleVoice} title="Switch to a video call where the panelists speak">
            <Icon name="cam" size={16} />
            Video call
          </button>
          <button className={`notes-toggle${showNotes ? ' on' : ''}`} onClick={toggleNotes} aria-pressed={showNotes} title="See the private notes the panelists pass to each other">
            <Icon name="eye" size={16} />
            {showNotes ? 'Hide the panel’s notes' : 'Show the panel’s notes'}
          </button>
          <button className="danger-outline" onClick={onEnd} disabled={Boolean(busy) || micBusy}>
            <Icon name="flag" size={16} />
            End interview
          </button>
        </div>
      </header>

      <section className="panel-stage" aria-label="The panel">
        {panel.panel.map((panelist) => (
          <PanelistTile key={panelist.id} panelist={panelist} asking={!answering && q?.speaker === panelist.id} steps={steps} />
        ))}
      </section>

      <section className="card panel-chat">
        <Conversation panel={panel} showNotes={showNotes} />

        {q && (
          <div className={`panel-line from-panel current${q.kind === 'follow_up' ? ' follow' : ''}`}>
            <AgentAvatar id={q.speaker} size="small" />
            <div className="panel-bubble">
              <div className="panel-who">
                <b>{nameOf(panel.panel, q.speaker)}</b>
                <span className={`chip${q.kind === 'follow_up' ? ' chip-follow' : ''}`}>{q.kind === 'follow_up' ? 'Follow-up' : `Question ${q.number} of ${q.total}`}</span>
              </div>
              <p className="panel-question">{q.question}</p>
              {q.kind === 'follow_up' && q.reason && (
                <p className="panel-why small">
                  <Icon name="sparkle" size={12} /> Why {nameOf(panel.panel, q.speaker)}: {q.reason}
                </p>
              )}
            </div>
          </div>
        )}

        {!q && !answering && (
          <div className="stalled">
            <Icon name="alert" size={20} />
            <div>
              <b>The last step didn't finish.</b>
              <p className="muted">The AI may have been unavailable. Your answer is saved, so nothing is lost.</p>
            </div>
            <button className="primary" onClick={onRetry} disabled={Boolean(busy)}>
              <Icon name="repeat" size={16} />
              Continue
            </button>
          </div>
        )}

        {answering && (
          <div className="panel-doing muted">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
            {doingNow(steps, panel.panel)}
          </div>
        )}
        <div ref={chatEndRef} />
      </section>

      {q && (
        <section className="card answer-card">
          <label className="field-label" htmlFor="panel-answer">
            Your answer to {nameOf(panel.panel, q.speaker)}
          </label>
          <textarea
            id="panel-answer"
            ref={boxRef}
            rows={5}
            maxLength={5000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={Boolean(busy) || micBusy}
            placeholder="Answer as you would in the room: the idea first, then an example from your own work."
          />
          <div className="answer-foot">
            <div className="answer-tools">
              <button className={`mic-btn ${voice.mode}`} onClick={onMic} disabled={Boolean(busy) || voice.mode === 'transcribing'}>
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
            <button className="primary" onClick={onSubmit} disabled={Boolean(busy) || micBusy || !answer.trim()}>
              {answering ? (
                <>
                  <span className="spinner small" />
                  The panel is listening…
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

      {busyText && (
        <p className="busy-note muted">
          <span className="spinner small" /> {busyText}
        </p>
      )}

      {error && (
        <div className="inline-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button className="small" onClick={onRetry} disabled={Boolean(busy)}>
            <Icon name="repeat" size={14} />
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// One panelist on the stage: their face, name and job. It glows while they ask, and shows what they are
// doing while your answer is handled ("Writing a note…", then a tick).
function PanelistTile({ panelist, asking, steps }) {
  const mine = steps.filter((step) => step.who === panelist.id)
  const running = mine.find((step) => !step.done)
  const wroteNote = mine.some((step) => step.node === 'listen' && step.done)
  return (
    <div className={`panelist-tile${asking ? ' asking' : ''}${running ? ' busy' : ''}`}>
      <AgentAvatar id={panelist.id} busy={Boolean(running)} />
      <span className="panelist-text">
        <b>{panelist.name}</b>
        <span className="muted small">{panelist.title}</span>
      </span>
      {asking && <span className="tile-badge">Asking</span>}
      {running && (
        <span className="tile-status small">
          <span className="spinner small" />
          {TILE_STATUS[running.node] || 'Thinking…'}
        </span>
      )}
      {!running && wroteNote && (
        <span className="tile-status small done">
          <Icon name="check" size={12} />
          Note written
        </span>
      )}
    </div>
  )
}

// Everything said so far, and (if shown) the notes the panel passed after each answer, plus the chair's call.
function Conversation({ panel, showNotes }) {
  const lines = []
  // the round of introductions comes first, like in the room
  for (const intro of panel.intros || []) {
    lines.push(
      <div key={`intro-${intro.speaker}`} className="panel-line from-panel intro">
        <AgentAvatar id={intro.speaker} size="small" />
        <div className="panel-bubble">
          <div className="panel-who">
            <b>{nameOf(panel.panel, intro.speaker)}</b>
          </div>
          <p>{intro.text}</p>
        </div>
      </div>,
    )
  }
  let turn = 0 // the answer number: notes and decisions carry it
  panel.transcript.forEach((line, index) => {
    if (line.speaker === 'you') {
      lines.push(
        <div key={index} className="panel-line from-you">
          <div className="panel-bubble">
            <div className="panel-who">
              <b>You</b>
            </div>
            <p>{line.text}</p>
          </div>
        </div>,
      )
      if (showNotes) lines.push(<Notes key={`notes-${turn}`} panel={panel} turn={turn} />)
      turn += 1
    } else {
      lines.push(
        <div key={index} className="panel-line from-panel">
          <AgentAvatar id={line.speaker} size="small" />
          <div className="panel-bubble">
            <div className="panel-who">
              <b>{nameOf(panel.panel, line.speaker)}</b>
              {line.kind === 'follow_up' && <span className="chip chip-follow">Follow-up</span>}
            </div>
            <p>{line.text}</p>
          </div>
        </div>,
      )
    }
  })
  return lines
}

// The panel's private notes about one answer, and what the chair decided next.
function Notes({ panel, turn }) {
  const notes = panel.notes.filter((note) => note.turn === turn && note.note)
  const decision = panel.decisions.find((d) => d.turn === turn)
  if (notes.length === 0 && !decision) return null
  return (
    <div className="panel-notes">
      {notes.map((note) => (
        <div key={note.by} className="panel-note">
          <AgentAvatar id={note.by} size="small" />
          <span>
            <b>{nameOf(panel.panel, note.by)}</b> <span className="muted">to the panel:</span> {note.note}
            {note.follow_up && <span className="note-wish"> Wants to ask: “{note.follow_up}”</span>}
          </span>
        </div>
      ))}
      {decision && (
        <div className="panel-note chair">
          <Icon name="flag" size={14} />
          <span>
            <b>The chair:</b> {chairText(panel, decision)}
          </span>
        </div>
      )}
    </div>
  )
}

// "Emily follows up. Emily flagged an unproven number."
function chairText(panel, decision) {
  const who = nameOf(panel.panel, decision.speaker)
  if (decision.action === 'follow_up') return `${who} follows up. ${decision.reason}`
  if (decision.action === 'new_question') return `${who} asks the next question. ${decision.reason}`
  return `Time to decide. ${decision.reason}`
}
