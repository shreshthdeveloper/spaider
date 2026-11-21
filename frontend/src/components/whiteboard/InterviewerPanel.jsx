import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import SpokenCaption from '../SpokenCaption'
import InterviewerAvatar from '../interview/InterviewerAvatar'

const NAME = 'Bella'

// The right side of the whiteboard and coding rounds: Bella on video, the conversation, and one reply bar.
//   messages        [{ role: 'interviewer' | 'candidate', text }]
//   voice           everything from useInterviewVoice()
//   looking         Bella is reviewing the board right now
//   draft/setDraft  what you are typing (kept by the page, so Bella does not review while you type)
//   onSend(text)    send what you said or typed
//   lookingLabel    what Bella is doing while she reviews ("Looking at your board", "Reading your code")
export default function InterviewerPanel({
  messages,
  voice,
  looking,
  disabled,
  draft,
  setDraft,
  onSend,
  lookingLabel = 'Looking at your board',
}) {
  // A new round: her greeting appears as she speaks it. An old round: everything is shown as it was.
  const [liveFrom] = useState(() => (messages.length === 1 ? 0 : messages.length))
  const logRef = useRef(null)

  const listening = voice.mode === 'listening'
  const transcribing = voice.mode === 'transcribing'
  const speaking = voice.mode === 'speaking'
  const lastBella = messages.map((m) => m.role).lastIndexOf('interviewer')

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, looking])

  function send() {
    const text = draft.trim()
    if (!text || disabled || looking) return
    onSend(text)
    setDraft('')
  }

  // First press: start listening. Second press: stop, and what you said is sent at once, like on a call.
  async function toggleMic() {
    if (listening) {
      const spoken = await voice.stopListening()
      if (spoken.trim()) onSend(spoken.trim())
    } else {
      voice.startListening()
    }
  }

  let badge = null
  if (looking) badge = <><Icon name="eye" size={13} /> {lookingLabel}</>
  else if (listening) badge = <><span className="rec-light" /> Listening to you</>
  else if (speaking) badge = <><span className="eq on"><i /><i /><i /></span> Speaking</>

  return (
    <aside className="wb-side">
      <div className={`wb-tile office${speaking ? ' speaking' : ''}${listening ? ' listening' : ''}`}>
        <InterviewerAvatar mode={looking ? 'thinking' : voice.mode} level={voice.level} name={NAME} />
        {badge && <div className="wb-tile-badge">{badge}</div>}
        <div className="nameplate">
          {NAME} · <span className="muted">Senior Engineer</span>
        </div>
        {voice.needsClick && (
          <button className="primary stage-play" onClick={voice.replay}>
            <Icon name="play" size={15} />
            Hear Bella
          </button>
        )}
      </div>

      <div className="wb-chat">
        <div className="wb-log" ref={logRef}>
          {messages.map((message, i) => {
            const bella = message.role === 'interviewer'
            return (
              <div key={i} className={`wb-msg ${bella ? 'bella' : 'you'}`}>
                {bella && <span className="wb-face">B</span>}
                <div className="wb-bubble">
                  {bella && i === lastBella && i >= liveFrom ? (
                    <SpokenCaption key={message.text} text={message.text} voice={voice} />
                  ) : (
                    message.text
                  )}
                </div>
              </div>
            )
          })}
          {looking && (
            <div className="wb-msg bella">
              <span className="wb-face">B</span>
              <div className="wb-bubble wb-typing">
                <span className="typing">
                  <span />
                  <span />
                  <span />
                </span>
                {lookingLabel}
              </div>
            </div>
          )}
        </div>

        {voice.voiceError && <p className="wb-voice-error">{voice.voiceError}</p>}

        <div className={`wb-composer${listening ? ' listening' : ''}`}>
          <button
            className="wb-mic"
            onClick={toggleMic}
            disabled={disabled || looking || transcribing}
            title={listening ? 'Stop and send' : 'Talk to Bella'}
            aria-label={listening ? 'Stop and send' : 'Talk to Bella'}
          >
            <Icon name={listening ? 'stop' : 'mic'} size={17} />
          </button>

          {listening && (
            <div className="wb-listen">
              <span className="rec-light" />
              Listening · {voice.seconds}s
              <span className="wb-meter">
                <i style={{ transform: `scaleX(${Math.max(0.04, voice.level)})` }} />
              </span>
            </div>
          )}
          {transcribing && (
            <div className="wb-listen muted">
              <span className="spinner small" /> Turning your words into text…
            </div>
          )}
          {!listening && !transcribing && (
            <textarea
              rows={1}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Talk to Bella, or type here…"
              disabled={disabled}
            />
          )}

          <button
            className="primary wb-send"
            onClick={send}
            disabled={disabled || looking || listening || !draft.trim()}
            aria-label="Send"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
        <div className="wb-hint">Tap the mic and talk, or type and press Enter</div>
      </div>
    </aside>
  )
}
