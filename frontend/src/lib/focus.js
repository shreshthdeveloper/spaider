import { useSyncExternalStore } from 'react'

// Focus mode ("monk mode"): the round fills the whole screen, and your spider watches you.
// Leave for another tab or app and she notices: the tab's title and icon call you back, a little
// "uh-oh" sound plays, and when you return she shows how long you were gone (components/focus/).
//
// What a web page can and can't do:
//   - it can't stop you leaving, and it can't pop up over another tab: it can only notice and react
//   - full screen needs a click to start, and switching tabs usually ends it, so coming back takes a click
//   - in Chrome and Edge, a quick Esc doesn't leave full screen while focus is on: you hold Esc instead
//
// One focus session lives here, outside React, so the Focus button (in a round's header) and the
// screens over the page (FocusLayer, in App) share it. Components read it with useFocus().

const GRACE_MS = 2000 // shorter trips away don't count (a permission prompt, a mis-click)
const NAG_EVERY_S = 30 // while you're away, the sound plays again this often

let state = {
  on: false,
  fullscreen: false, // the page is full screen right now
  startedAt: 0,
  switches: 0, // times you left for longer than GRACE_MS
  awayMs: 0, // all that time away, added up
  leftAt: 0, // when you left; 0 while you're here
  stretchFrom: 0, // when the current stretch of focus began, for the longest stretch
  longestMs: 0,
  caught: null, // { seconds, count }: the "caught you" screen after you come back
  summary: null, // { focusedMs, switches, awayMs, longestMs }: the report after focus ends
}
const listeners = new Set()

function update(change) {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return state
}

// The current focus session, kept up to date in any component.
export function useFocus() {
  return useSyncExternalStore(subscribe, snapshot)
}

// How cross she is: one step angrier for each time you left (a mood name, as in lib/moods.js).
export function angerMood(switches) {
  if (switches === 0) return 'happy'
  if (switches === 1) return 'okay'
  if (switches === 2) return 'itchy'
  return 'angry'
}

// ---- start and end ----

// Call it from a click: browsers only allow full screen and sound after one.
export function startFocus() {
  if (state.on) return
  const now = Date.now()
  update({
    on: true,
    startedAt: now,
    switches: 0,
    awayMs: 0,
    leftAt: 0,
    stretchFrom: now,
    longestMs: 0,
    caught: null,
    summary: null,
  })
  prepareSound()
  enterFullscreen()
  window.addEventListener('blur', leave)
  window.addEventListener('focus', comeBack)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('beforeunload', askBeforeClosing)
}

// Ends focus and shows how it went.
export function endFocus() {
  if (!state.on) return
  window.removeEventListener('blur', leave)
  window.removeEventListener('focus', comeBack)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('beforeunload', askBeforeClosing)
  stopAlarm()
  navigator.keyboard?.unlock?.()
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})

  const now = Date.now()
  let awayMs = state.awayMs
  let longestMs = state.longestMs
  if (state.leftAt) awayMs += now - state.leftAt // ended while away (e.g. from another window)
  else longestMs = Math.max(longestMs, now - state.stretchFrom)
  const summary = {
    focusedMs: now - state.startedAt - awayMs,
    switches: state.switches,
    awayMs,
    longestMs,
  }
  update({ on: false, fullscreen: false, leftAt: 0, caught: null, summary })
}

export function closeSummary() {
  update({ summary: null })
}

export function closeCaught() {
  update({ caught: null })
}

// Full screen (again, after Esc or a tab switch ended it). Only works from a click.
export function enterFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) return
  update({ fullscreen: true }) // expected; the fullscreenchange event, or the failure below, corrects it
  document.documentElement
    .requestFullscreen()
    .then(() => navigator.keyboard?.lock?.(['Escape'])) // Chrome/Edge: hold Esc to leave, a tap does nothing
    .catch(() => update({ fullscreen: false })) // not allowed now: focus mode still works, just not full screen
}

// Rounds show the Focus button. When the last one disappears (the round finished, or you left it),
// focus ends by itself. The check waits a moment, because switching the interview between voice and
// text swaps one button for another in the same instant.
let buttons = 0

export function buttonShown() {
  buttons += 1
  return () => {
    buttons -= 1
    setTimeout(() => {
      if (buttons === 0) endFocus()
    }, 0)
  }
}

// ---- leaving and coming back ----

function onVisibility() {
  if (document.visibilityState === 'hidden') leave()
  else if (document.hasFocus()) comeBack()
}

function leave() {
  if (state.leftAt) return // already away (switching tabs fires both blur and visibilitychange)
  update({ leftAt: Date.now() })
  startAlarm()
}

function comeBack() {
  if (!state.leftAt) return
  stopAlarm()
  const now = Date.now()
  const awayMs = now - state.leftAt
  if (awayMs < GRACE_MS) {
    update({ leftAt: 0 })
    return
  }
  const switches = state.switches + 1
  update({
    leftAt: 0,
    switches,
    awayMs: state.awayMs + awayMs,
    longestMs: Math.max(state.longestMs, state.leftAt - state.stretchFrom),
    stretchFrom: now,
    caught: { seconds: Math.round(awayMs / 1000), count: switches },
  })
}

function onFullscreenChange() {
  update({ fullscreen: Boolean(document.fullscreenElement) })
}

function askBeforeClosing(event) {
  event.preventDefault() // the browser asks "Leave site?"
  event.returnValue = ''
}

// ---- the alarm while you're away: tab title, tab icon and sound ----

// Your spider, angry, as the tab's icon. #c53030 is her angry colour (styles/stats.css).
const ANGRY_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<g stroke="#c53030" stroke-width="4" stroke-linecap="round" fill="none">' +
      '<path d="M18 28L4 18M18 34L3 34M18 40L5 52M46 28L60 18M46 34L61 34M46 40L59 52"/></g>' +
      '<circle cx="32" cy="36" r="17" fill="#c53030"/>' +
      '<circle cx="25" cy="34" r="5" fill="#fff"/><circle cx="39" cy="34" r="5" fill="#fff"/>' +
      '<circle cx="26" cy="35" r="2.4"/><circle cx="40" cy="35" r="2.4"/>' +
      '<path d="M19 26L29 30M45 26L35 30M27 45Q32 40 37 45" stroke="#1f2328" stroke-width="2.6" ' +
      'stroke-linecap="round" fill="none"/></svg>',
  )

let alarm = null // { timer, title, icon, soundAt } while it runs

function startAlarm() {
  const link = document.querySelector('link[rel="icon"]')
  alarm = { timer: null, title: document.title, icon: link?.getAttribute('href'), soundAt: GRACE_MS / 1000 }
  if (link) link.setAttribute('href', ANGRY_ICON)
  document.title = '🕷️ Come back!'
  alarm.timer = setInterval(() => {
    const seconds = Math.floor((Date.now() - state.leftAt) / 1000)
    document.title = `🕷️ Come back! ${clock(seconds)}`
    if (seconds >= alarm.soundAt) {
      uhOh(state.switches)
      alarm.soundAt += NAG_EVERY_S // and again every NAG_EVERY_S seconds while you stay away
    }
  }, 1000)
}

function stopAlarm() {
  if (!alarm) return
  clearInterval(alarm.timer)
  document.title = alarm.title
  const link = document.querySelector('link[rel="icon"]')
  if (link && alarm.icon) link.setAttribute('href', alarm.icon)
  alarm = null
}

let sound = null // one AudioContext, made on the Focus click (browsers block sound made without one)

function prepareSound() {
  try {
    sound = sound || new AudioContext()
    sound.resume()
  } catch {
    sound = null // no Web Audio: focus mode works without the sound
  }
}

// A soft two-note "uh-oh", lower each time you've left before.
function uhOh(switches) {
  if (!sound) return
  const pitch = Math.max(330, 660 - switches * 80)
  playNote(pitch, 0)
  playNote(pitch * 0.75, 0.16)
}

function playNote(hertz, delay) {
  const start = sound.currentTime + delay
  const tone = sound.createOscillator()
  const volume = sound.createGain()
  tone.type = 'triangle'
  tone.frequency.value = hertz
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.exponentialRampToValueAtTime(0.08, start + 0.02)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
  tone.connect(volume).connect(sound.destination)
  tone.start(start)
  tone.stop(start + 0.15)
}

// 1 -> "1 tab switch", 3 -> "3 tab switches"
export function switchesText(count) {
  return count === 1 ? '1 tab switch' : `${count} tab switches`
}

// 75 -> "1:15"
export function clock(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
