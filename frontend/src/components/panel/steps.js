// Words for the panel's live steps (backend/services/panel/nodes.py) and its decisions.

// What a panelist's tile says while their step runs.
export const TILE_STATUS = {
  grade: 'Scoring your answer…',
  listen: 'Writing a note…',
  verdict: 'Deciding…',
}

// The panelist's name ("John") for an id, or the id itself.
export function nameOf(panel, id) {
  for (const panelist of panel) if (panelist.id === id) return panelist.name
  return id
}

// One line under the chat for what the panel is doing now.
//   steps  [{ id, node, who, done }] from the live stream
export function doingNow(steps, panel) {
  const running = steps.filter((step) => !step.done)
  const current = running[running.length - 1]
  if (!current) return 'Thinking…'
  if (current.node === 'grade') return `${nameOf(panel, current.who)} is scoring your answer…`
  if (current.node === 'listen' || running.some((step) => step.node === 'listen')) {
    const listens = steps.filter((step) => step.node === 'listen')
    const written = listens.filter((step) => step.done).length
    return `The panel is writing notes to each other (${written} of ${listens.length})…`
  }
  if (current.node === 'moderator') return 'The panel is deciding who asks next…'
  if (current.node === 'verdict') return 'Each panelist is making a decision…'
  if (current.node === 'debrief') return 'The panel is agreeing on a decision…'
  return 'Getting the next question ready…'
}

// "strong hire" -> a colour class for its chip
export function decisionClass(decision) {
  if (decision === 'strong hire' || decision === 'hire' || decision === 'Hire') return 'decision-good'
  if (decision === 'no hire' || decision === 'strong no hire' || decision === 'No hire') return 'decision-bad'
  return 'decision-mid'
}
