// Words for a claim's colour, kind and next day. The backend sets them (backend/services/resume_grind/).

export const LEVELS = {
  green: { name: 'Defended', short: 'defended' },
  yellow: { name: 'Shaky', short: 'shaky' },
  red: { name: "Can't back it up", short: "can't back up" },
  untested: { name: 'Not asked yet', short: 'not asked' },
}

// the order of the colour bar and its legend
export const LEVEL_ORDER = ['green', 'yellow', 'red', 'untested']

export const KINDS = {
  number: 'Number',
  tech: 'Tech',
  lead: 'Leadership',
  project: 'Project',
}

// "2026-11-25" -> "Back in 3 days"; today or earlier (or "") -> "Due today"
export function dueText(due) {
  const today = new Date().toISOString().slice(0, 10)
  if (!due || due <= today) return 'Due today'
  const days = Math.round((new Date(due) - new Date(today)) / 86400000)
  return days === 1 ? 'Back tomorrow' : `Back in ${days} days`
}

// The claims that cover line `index` of the resume.
export function claimsOnLine(claims, index) {
  const found = []
  for (const claim of claims) {
    if (claim.line !== null && index >= claim.line && index < claim.line + claim.line_count) found.push(claim)
  }
  return found
}
