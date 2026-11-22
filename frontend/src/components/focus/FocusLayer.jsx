import { useEffect, useRef, useState } from 'react'
import {
  angerMood,
  clock,
  closeCaught,
  closeSummary,
  endFocus,
  enterFullscreen,
  switchesText,
  useFocus,
} from '../../lib/focus'
import Icon from '../Icon'
import { SpiderArt } from '../SpiderLoader'
import Cobweb from './Cobweb'

// The focus-mode screens over the whole app (App.jsx shows this once). See lib/focus.js.
//   - "Caught you", when you come back from another tab or app
//   - a small bar when you left full screen (Esc) but stayed on the page
//   - how it went, when focus ends
export default function FocusLayer() {
  const focus = useFocus()
  const outOfFullscreen = focus.on && !focus.fullscreen && !focus.caught && !focus.leftAt && document.fullscreenEnabled

  return (
    <>
      {outOfFullscreen && <OutOfFullscreen />}
      {focus.caught && <CaughtYou caught={focus.caught} />}
      {focus.summary && <FocusSummary summary={focus.summary} />}
    </>
  )
}

// What she says when you come back: crosser each time.
function caughtWords({ seconds, count }) {
  const away = clock(seconds)
  let words = { title: 'Hey! Eyes here 👀', line: `You slipped away for ${away}. I noticed.` }
  if (count === 2) words = { title: 'Again?!', line: `${away} away. My legs are getting itchy…` }
  if (count >= 3) words = { title: `That's ${count} times!`, line: `You were gone ${away}. I'm not happy.` }
  if (seconds >= 60) words.line += ' I had time to spin a web over everything.'
  return words
}

const TEAR_MS = 450 // how long the web takes to tear when you brush it away

// The screen you come back to. It is a <dialog>, so nothing behind it can be clicked (and the voice
// call's Space-to-talk stays off) until you brush the web away.
function CaughtYou({ caught }) {
  const dialogRef = useRef(null)
  const [torn, setTorn] = useState(false)
  const mood = angerMood(caught.count)
  const words = caughtWords(caught)

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  // Full screen needs a click, so it's asked for right here, not after the tearing animation.
  function brushAway() {
    if (torn) return
    enterFullscreen()
    setTorn(true)
    setTimeout(closeCaught, TEAR_MS)
  }

  // Esc does the same as the button
  function handleCancel(e) {
    e.preventDefault()
    brushAway()
  }

  return (
    <dialog ref={dialogRef} className={`caught mood-${mood}${torn ? ' torn' : ''}`} onCancel={handleCancel}>
      <Cobweb seconds={caught.seconds} />
      <div className="caught-spider">
        <SpiderArt mood={mood === 'happy' ? undefined : mood} />
      </div>
      <div className="caught-box">
        <h2>{words.title}</h2>
        <p>{words.line}</p>
        <div className="caught-facts muted small">
          <span>
            <Icon name="clock" size={13} /> Away {clock(caught.seconds)}
          </span>
          <span>
            <Icon name="target" size={13} /> {switchesText(caught.count)} so far
          </span>
        </div>
        <button className="primary" onClick={brushAway} autoFocus>
          <Icon name="x" size={16} />
          Brush the web away, I'm back
        </button>
      </div>
    </dialog>
  )
}

// You pressed Esc (or held it): still on the page, but no longer full screen.
function OutOfFullscreen() {
  return (
    <div className="focus-toast mood-okay" role="status">
      <span className="focus-toast-spider">
        <SpiderArt mood="okay" />
      </span>
      <span>
        <b>Leaving full screen?</b> Focus mode is still on.
      </span>
      <button className="small primary" onClick={enterFullscreen}>
        Full screen
      </button>
      <button className="small" onClick={endFocus}>
        End focus
      </button>
    </div>
  )
}

function summaryLine(switches) {
  if (switches === 0) return 'Monk mode, perfect. Not a single peek at another tab.'
  if (switches <= 2) return `Nearly there: ${switchesText(switches)}. Close the other tabs first next time.`
  return `${switchesText(switches)}. I spent the round spinning webs.`
}

// How it went, after focus ends. A <dialog> in the style of the "Are you sure?" box.
function FocusSummary({ summary }) {
  const dialogRef = useRef(null)
  const mood = angerMood(summary.switches)
  const facts = [
    { label: 'Focused', value: clock(Math.round(summary.focusedMs / 1000)) },
    { label: 'Tab switches', value: summary.switches },
    { label: 'Time away', value: clock(Math.round(summary.awayMs / 1000)) },
    { label: 'Longest stretch', value: clock(Math.round(summary.longestMs / 1000)) },
  ]

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  // Esc closes it, through React like the Done button
  function handleCancel(e) {
    e.preventDefault()
    closeSummary()
  }

  return (
    <dialog ref={dialogRef} className={`confirm-dialog focus-summary mood-${mood}`} onCancel={handleCancel}>
      <div className="confirm-box">
        <div className="focus-summary-spider">
          <SpiderArt mood={mood === 'happy' ? undefined : mood} />
        </div>
        <h2>Focus session done</h2>
        <p>{summaryLine(summary.switches)}</p>
        <div className="focus-facts">
          {facts.map((fact) => (
            <div key={fact.label} className="focus-fact">
              <b>{fact.value}</b>
              <span className="muted small">{fact.label}</span>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="primary" onClick={closeSummary} autoFocus>
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}
