// The steps (nodes) of the interview graph, in plain words. The real wiring is backend/services/interview/graph.py.

export const STEP_NAMES = {
  plan_questions: 'Plan questions',
  ask: 'Ask',
  grade: 'Grade',
  follow_up: 'Follow-up',
  next_question: 'Next question',
  write_report: 'Write report',
}

const STEP_DOING = {
  plan_questions: 'Planning the questions',
  ask: 'Reading your answer',
  grade: 'Grading your answer against the key points',
  follow_up: 'Writing a follow-up question',
  next_question: 'Moving on to the next question',
  write_report: 'Writing your report',
}

// What the interviewer is doing right now, from the live steps [{ node, done }] of the answer being graded.
// "ask" runs twice per answer: first it takes your answer, at the end it asks the next question.
export function doingNow(steps) {
  const last = steps[steps.length - 1]
  if (!last) return STEP_DOING.ask
  if (last.node === 'ask' && steps.length > 1) return 'Getting the next question ready'
  return STEP_DOING[last.node] || 'Thinking'
}
