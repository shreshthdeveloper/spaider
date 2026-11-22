import { useEffect, useState } from 'react'
import { angerMood, buttonShown, clock, endFocus, startFocus, switchesText, useFocus } from '../../lib/focus'
import ConfirmDialog from '../ConfirmDialog'
import Icon from '../Icon'
import { SpiderArt } from '../SpiderLoader'

// The Focus button, in a round's header (see lib/focus.js for what focus mode does).
// Off: a "Focus" button. On: your spider (crosser after each tab switch), the time focused and the
// number of switches; a click asks whether to end focus. When the round ends, focus ends by itself.
//   small   the smaller buttons of the voice call's header
export default function FocusButton({ small = false }) {
  const focus = useFocus()
  const [asking, setAsking] = useState(false) // the "End focus mode?" box is open
  const [now, setNow] = useState(Date.now)

  useEffect(() => buttonShown(), [])

  // the clock on the button, while focus is on
  useEffect(() => {
    if (!focus.on) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [focus.on])

  if (!focus.on) {
    return (
      <button className={`focus-btn${small ? ' small' : ''}`} onClick={startFocus} title="Full screen, and your spider watches for tab switches">
        <Icon name="target" size={small ? 15 : 16} />
        Focus
      </button>
    )
  }

  const mood = angerMood(focus.switches)
  const seconds = Math.max(0, Math.floor((now - focus.startedAt) / 1000))

  function end() {
    setAsking(false)
    endFocus()
  }

  return (
    <>
      <button
        className={`focus-pill mood-${mood}${small ? ' small' : ''}`}
        onClick={() => setAsking(true)}
        title="Focus mode is on. Click to end it."
      >
        <span className="focus-pill-spider">
          <SpiderArt mood={mood === 'happy' ? undefined : mood} />
        </span>
        <span className="focus-pill-time">{clock(seconds)}</span>
        {focus.switches > 0 && (
          <span className="focus-pill-count" aria-label={switchesText(focus.switches)}>
            {focus.switches}
          </span>
        )}
      </button>

      <ConfirmDialog
        open={asking}
        icon="target"
        title="End focus mode?"
        text={`Focused for ${clock(seconds)}, with ${switchesText(focus.switches)}. Your spider will tell you how it went.`}
        confirmLabel="End focus"
        onConfirm={end}
        onCancel={() => setAsking(false)}
      />
    </>
  )
}
