// Small display helpers shared by pages.

// The backend sends UTC dates without a "Z". Add it, so the browser shows the right local time.
export function formatDate(iso) {
  if (!iso) return ''
  const hasZone = /([zZ]|[+-]\d\d:\d\d)$/.test(iso)
  const date = new Date(hasZone ? iso : `${iso}Z`)
  const day = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}

// Colour class for a score out of 5.
export function scoreClass(score) {
  if (score === null || score === undefined) return 'score-none'
  if (score >= 4) return 'score-good'
  if (score >= 3) return 'score-mid'
  return 'score-bad'
}

// "1 page", "3 pages"
export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// Rough interview length in minutes: about 2 minutes per answer, plus some follow-ups.
export function estimateMinutes(questions, followUps) {
  return Math.max(1, Math.round(questions * (2 + followUps * 0.5)))
}
