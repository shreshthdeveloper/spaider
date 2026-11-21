// When each word of a spoken line is said. The 3D interviewer moves her lips with it, and the captions
// show each word at the same moment, so the words on screen never run ahead of her voice.

const WORDS_PER_SECOND = 2.6 // a normal speaking speed, used when there is no audio to measure

// About how long `text` takes to say, in milliseconds.
export function estimateMs(text) {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1000, (words / WORDS_PER_SECOND) * 1000)
}

// Spread the words over the audio, giving longer words and pauses after punctuation more time.
// Returns { words, wtimes (when each word starts, ms), wdurations (how long each lasts, ms) }.
export function wordTimings(text, totalMs) {
  const words = text.split(/\s+/).filter(Boolean)
  const weights = words.map((w) => w.replace(/[^A-Za-z0-9]/g, '').length + 2 + (/[.,;:?!]$/.test(w) ? 3 : 0))
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const lead = 60
  const usable = Math.max(200, totalMs - lead * 2)

  const wtimes = []
  const wdurations = []
  let t = lead
  for (const weight of weights) {
    const duration = (usable * weight) / sum
    wtimes.push(t)
    wdurations.push(duration * 0.92)
    t += duration
  }
  return { words, wtimes, wdurations }
}

// How many words have been said `elapsedMs` after the voice started.
export function wordsSaid(text, totalMs, elapsedMs) {
  const { words, wtimes } = wordTimings(text, totalMs)
  let count = 0
  while (count < words.length && wtimes[count] <= elapsedMs) count += 1
  return count
}
