import { useEffect, useState } from 'react'
import { wordsSaid } from '../lib/captions'

const GIVE_UP_MS = 8000 // if the voice has not started by then (slow, or sound blocked), show the words anyway

// Bella's words appear as she says them, in step with her real voice: the same timing moves her lips
// (lib/captions.js). While her voice is still loading, it shows typing dots instead of running ahead.
// Give it key={text}, so each new line starts fresh.
//   text    what she says
//   voice   from useInterviewVoice(): voiceOn, speech { text, startedAt, durationMs }, said
export default function SpokenCaption({ text, voice }) {
  const [now, setNow] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const speech = voice.speech?.text === text ? voice.speech : null
  const speaking = Boolean(speech?.startedAt)
  const showAll = !voice.voiceOn || voice.said === text || gaveUp

  // While she speaks, look at the clock about 12 times a second to show the next words.
  useEffect(() => {
    if (!speaking) return
    const timer = setInterval(() => setNow(performance.now()), 80)
    return () => clearInterval(timer)
  }, [speaking])

  // Still waiting for her voice: after a few seconds, stop waiting.
  useEffect(() => {
    if (speaking || showAll) return
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [speaking, showAll])

  if (speaking && !gaveUp) {
    const words = text.split(/\s+/).filter(Boolean)
    const count = wordsSaid(text, speech.durationMs, now - speech.startedAt)
    return (
      <>
        {words.slice(0, count).join(' ')}
        {count < words.length && <span className="spoken-caret" />}
      </>
    )
  }
  if (showAll) return text
  return (
    <span className="typing" aria-label="Bella is about to speak">
      <span />
      <span />
      <span />
    </span>
  )
}
