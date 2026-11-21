// How each member of the question bank panel looks: every agent is a little spider in its own colour.
// Their names and jobs come from the backend (services/question_bank/agents.py).
export const AGENT_LOOKS = {
  coordinator: { icon: 'network', color: '#24463f', role: 'Splits the work' },
  technical: { icon: 'bolt', color: '#2f6fd0' },
  python: { icon: 'keyboard', color: '#b7791f' },
  system_design: { icon: 'server', color: '#7b4fd6' },
  coding: { icon: 'code', color: '#0f8a74' },
  resume: { icon: 'file', color: '#d0562f' },
  recruiter: { icon: 'users', color: '#c2417e' },
  judge: { icon: 'eye', color: '#6e6862', role: 'The bar raiser: an LLM judge' },
  you: { icon: 'user', color: '#2f6f62', role: 'Human in the loop' },
}

export function lookOf(id) {
  return AGENT_LOOKS[id] || { icon: 'sparkle', color: '#6f6a62' }
}

// The three kinds of question, and where you practise each one.
export const QUESTION_TYPES = {
  qa: { label: 'Q&A', icon: 'target', round: 'mock interview' },
  whiteboard: { label: 'Whiteboard', icon: 'pen', round: 'whiteboard round' },
  coding: { label: 'Coding', icon: 'code', round: 'coding round' },
}

// Where a question's "based on" quote was found.
export const SOURCES = {
  jd: 'From your JD',
  resume: 'From your resume',
  topics: 'From your topics',
  docs: 'From your documents',
}

// What the judge scores every question on (services/question_bank/nodes.py, RUBRIC), 1 to 5.
export const RUBRIC = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'level', label: 'Level' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'answer', label: 'Answer' },
]
