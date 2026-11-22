// Every call to the Flask backend goes through this file.
// If a route or payload changes, this is the only frontend file to edit.

const OFFLINE = "Can't reach the backend. Is the Flask server running?"

// Tells the sidebar right away whether the backend answered.
function reportStatus(online) {
  window.dispatchEvent(new CustomEvent('backend-status', { detail: online }))
}

// Tells the sidebar that its "Recent" lists may have changed.
function notifyRecentChanged() {
  window.dispatchEvent(new Event('recent-changed'))
}

// An Error that also carries the HTTP status, so pages can react to e.g. 404.
function apiError(message, status = 0) {
  const err = new Error(message)
  err.status = status
  return err
}

// The error to show for a response that is not OK. data is the JSON body ({} if there was none).
function responseError(status, data) {
  if (data.error) return apiError(data.error, status)
  if (status >= 500) return apiError(`The server had a problem (${status}). Check the backend terminal.`, status)
  return apiError(`Request failed (${status})`, status)
}

async function request(path, options = {}) {
  // JSON bodies need this header. A file upload (FormData) must not have it:
  // the browser then sets the right "multipart" header itself.
  const isUpload = options.body instanceof FormData
  const headers = isUpload ? {} : { 'Content-Type': 'application/json' }

  let res
  try {
    res = await fetch(path, { headers, ...options })
  } catch {
    reportStatus(false)
    throw apiError(OFFLINE)
  }

  // 502/503/504 come from the Vite proxy when Flask is not running.
  const unreachable = [502, 503, 504].includes(res.status)
  reportStatus(!unreachable)
  if (unreachable) throw apiError(OFFLINE, res.status)

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw responseError(res.status, data)
  return data
}

// ---- Live streams (Server-Sent Events, backend/services/sse.py)
// The server keeps the response open and sends small messages while it works. Each one ends with an empty line:
//   event: finish
//   data: {"node": "grade"}
// The browser's EventSource can only send GET requests, so this reads the stream from fetch() itself.
// onEvent(name, data) runs for every message as it arrives. The promise resolves with the "done" message's
// data, or rejects (status 500) if the server sent an "error" message.
async function streamRequest(path, body, onEvent) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    reportStatus(false)
    throw apiError(OFFLINE)
  }
  const unreachable = [502, 503, 504].includes(res.status)
  reportStatus(!unreachable)
  if (unreachable) throw apiError(OFFLINE, res.status)
  if (!res.ok) throw responseError(res.status, await res.json().catch(() => ({}))) // e.g. 400 "answer is required"

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let result = null
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // A piece of the stream can end in the middle of a message, so keep the unfinished part for the next piece.
    const messages = buffer.split('\n\n')
    buffer = messages.pop()
    for (const message of messages) {
      const { name, data } = readMessage(message)
      if (name === 'error') throw apiError(data.error, 500)
      if (name === 'done') result = data
      onEvent(name, data)
    }
  }
  if (!result) throw apiError('The connection closed before the answer was finished.', 500)
  return result
}

// "event: finish\ndata: {...}" -> { name: 'finish', data: {...} }
function readMessage(text) {
  let name = 'message'
  let data = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('event: ')) name = line.slice(7)
    if (line.startsWith('data: ')) data += line.slice(6)
  }
  return { name, data: data ? JSON.parse(data) : {} }
}

export function getHealth() {
  return request('/api/health')
}

// sessionId is null for a new chat; the backend then creates one and returns it.
export async function sendChat(message, sessionId = null) {
  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  notifyRecentChanged()
  return data
}

export function getChat(sessionId) {
  return request(`/api/chat/${encodeURIComponent(sessionId)}`)
}

// ---- Mock interview. Every call returns the interview "view":
// { id, topic, status, num_questions, answered, question, report, results }

// settings: { topic, numQuestions, difficulty, followUps, mode }
export async function startInterview(settings) {
  const view = await request('/api/interviews', {
    method: 'POST',
    body: JSON.stringify({
      topic: settings.topic,
      num_questions: settings.numQuestions,
      difficulty: settings.difficulty,
      follow_ups: settings.followUps,
      mode: settings.mode,
    }),
  })
  notifyRecentChanged()
  return view
}

export function listInterviews() {
  return request('/api/interviews')
}

export function getInterview(id) {
  return request(`/api/interviews/${encodeURIComponent(id)}`)
}

export async function answerInterview(id, answer) {
  const view = await request(`/api/interviews/${encodeURIComponent(id)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
  notifyRecentChanged()
  return view
}

// The same, live: onStep('start' | 'finish', { node }) for each step of the interview graph while it runs.
export async function answerInterviewLive(id, answer, onStep) {
  const view = await streamRequest(`/api/interviews/${encodeURIComponent(id)}/answer/live`, { answer }, onStep)
  notifyRecentChanged()
  return view
}

// Every step the interview graph took: { steps: [{ node, title, details, next, reason, ms }], now, taken }
export function getInterviewXray(id) {
  return request(`/api/interviews/${encodeURIComponent(id)}/xray`)
}

export async function endInterview(id) {
  const view = await request(`/api/interviews/${encodeURIComponent(id)}/end`, { method: 'POST' })
  notifyRecentChanged()
  return view
}

// Continue after a failed step (e.g. the AI was down). Safe to call any time.
export async function retryInterview(id) {
  const view = await request(`/api/interviews/${encodeURIComponent(id)}/retry`, { method: 'POST' })
  notifyRecentChanged()
  return view
}

// ---- Documents (RAG). A document: { id, filename, pages, chunks, created_at }

// Uploads a PDF. fetch() cannot report upload progress, so this one call uses XMLHttpRequest:
// onProgress(fraction) is called with 0 to 1 while the file is being sent. The promise resolves
// when the backend has read, split, embedded and stored the whole file.
export function uploadDocument(file, onProgress = () => {}) {
  const form = new FormData()
  form.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/documents')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.upload.onload = () => onProgress(1) // all sent; the backend is working on it now
    xhr.onerror = () => {
      reportStatus(false)
      reject(apiError(OFFLINE))
    }
    xhr.onload = () => {
      const unreachable = [502, 503, 504].includes(xhr.status)
      reportStatus(!unreachable)
      if (unreachable) return reject(apiError(OFFLINE, xhr.status))

      let data = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(responseError(xhr.status, data))
    }
    xhr.send(form)
  })
}

export function listDocuments() {
  return request('/api/documents')
}

export function deleteDocument(id) {
  return request(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function getDocument(id) {
  return request(`/api/documents/${encodeURIComponent(id)}`)
}

// Returns { answer, found, sources: [{ page, score, text }] }
// Every chunk of the document as a point in 3D, plus the recipe to place a question on the same map.
export function getDocumentMap(id) {
  return request(`/api/documents/${encodeURIComponent(id)}/map`)
}

export function askDocument(id, question) {
  return request(`/api/documents/${encodeURIComponent(id)}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

// The same answer, word by word: onEvent('retrieved', { trace }), then onEvent('token', { text }) many times.
// Resolves with the finished answer (the same shape as askDocument).
export function askDocumentLive(id, question, onEvent) {
  return streamRequest(`/api/documents/${encodeURIComponent(id)}/ask/live`, { question }, onEvent)
}

// ---- AI traces (debugging): every LLM call the backend made

// One page of AI calls, newest first: { traces, total, page, pages, labels }.
// label shows only one kind of call (e.g. 'coding_review'); empty = all.
export function listTraces({ page = 1, perPage = 20, label = '' } = {}) {
  const query = new URLSearchParams({ page, per_page: perPage })
  if (label) query.set('label', label)
  return request(`/api/traces?${query}`)
}

export function getTrace(id) {
  return request(`/api/traces/${encodeURIComponent(id)}`)
}

// ---- Voice (mock interview)

// MP3 audio of the interviewer saying `text`. Throws if OpenAI voice is unavailable,
// so the caller can use the browser's own voice instead. voice: a panelist's voice, or '' for Bella's.
export async function requestSpeech(text, voice = '') {
  const res = await fetch('/api/voice/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) throw apiError('OpenAI voice is not available', res.status)
  return res.blob()
}

// Sends a recorded answer; returns { text }. `hint` (the question) helps with technical words.
export function transcribeAnswer(audio, hint) {
  const extension = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', audio, `answer.${extension}`)
  form.append('hint', hint || '')
  return request('/api/voice/transcribe', { method: 'POST', body: form })
}

// ---------------------------------------------------------------- whiteboard (system design round)

export function listWhiteboardQuestions() {
  return request('/api/whiteboard/questions')
}

export function listWhiteboards() {
  return request('/api/whiteboard')
}

// Either { questionId } from the list, or your own { question, brief }.
export async function startWhiteboard({ questionId, question, brief }) {
  const data = await request('/api/whiteboard', {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, question, brief }),
  })
  notifyRecentChanged()
  return data
}

export function getWhiteboard(id) {
  return request(`/api/whiteboard/${encodeURIComponent(id)}`)
}

// Saves the drawing without asking the AI anything.
export function saveWhiteboardScene(id, scene) {
  return request(`/api/whiteboard/${encodeURIComponent(id)}/scene`, {
    method: 'PUT',
    body: JSON.stringify({ scene }),
  })
}

// The interviewer looks at the board. image is a PNG data URL (or null); reply is what you said, if anything.
export function reviewWhiteboard(id, { scene, image, reply }) {
  return request(`/api/whiteboard/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ scene, image, reply }),
  })
}

export async function finishWhiteboard(id, { scene, image }) {
  const data = await request(`/api/whiteboard/${encodeURIComponent(id)}/finish`, {
    method: 'POST',
    body: JSON.stringify({ scene, image }),
  })
  notifyRecentChanged()
  return data
}

// ---------------------------------------------------------------- coding round (Python)

export function listCodingProblems() {
  return request('/api/coding/problems')
}

export function listCodingRounds() {
  return request('/api/coding')
}

// problemId is a problem's id, or 'surprise' (then difficulty can be 'easy' or 'medium'). mode: 'interview' | 'practice'.
export async function startCodingRound({ problemId, difficulty, mode }) {
  const data = await request('/api/coding', {
    method: 'POST',
    body: JSON.stringify({ problem_id: problemId, difficulty, mode }),
  })
  notifyRecentChanged()
  return data
}

export function getCodingRound(id) {
  return request(`/api/coding/${encodeURIComponent(id)}`)
}

// Saves the code without asking the AI anything.
export function saveCode(id, code) {
  return request(`/api/coding/${encodeURIComponent(id)}/code`, { method: 'PUT', body: JSON.stringify({ code }) })
}

// Bella reads the code. results = the latest test results; reply = what you said; hint = you asked for a hint.
export function reviewCode(id, { code, results, reply, hint }) {
  return request(`/api/coding/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ code, results, reply, hint }),
  })
}

export async function finishCodingRound(id, { code, results }) {
  const data = await request(`/api/coding/${encodeURIComponent(id)}/finish`, {
    method: 'POST',
    body: JSON.stringify({ code, results }),
  })
  notifyRecentChanged()
  return data
}

// ---------------------------------------------------------------- stats (your streak, your spider, your web)

// Sends your time zone (minutes ahead of UTC), so "today" on the server is your today.
export function getStats() {
  return request(`/api/stats?minutes_ahead=${-new Date().getTimezoneOffset()}`)
}

// ---------------------------------------------------------------- question bank (an agent panel writes your questions)

export function listBankAgents() {
  return request('/api/question-banks/agents')
}

export function listBanks() {
  return request('/api/question-banks')
}

// form is a FormData: company, position, interview_type, level, topics, jd or jd_file, resume or resume_file, agents (many)
export async function createBank(form) {
  const bank = await request('/api/question-banks', { method: 'POST', body: form })
  notifyRecentChanged()
  return bank
}

export function getBank(id) {
  return request(`/api/question-banks/${encodeURIComponent(id)}`)
}

export function retryBank(id) {
  return request(`/api/question-banks/${encodeURIComponent(id)}/retry`, { method: 'POST' })
}

export function deleteBank(id) {
  return request(`/api/question-banks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Review mode: your decision where the panel paused (bank.pending says what it asks).
//   plan:    { agents: [ids to keep], briefs: { id: brief } }
//   verdict: { allow_send_back, send_back_note, restore: [dropped question ids to keep] }
export function reviewBank(id, decision) {
  return request(`/api/question-banks/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(decision) })
}

// Starts a round from picked questions. Returns { page }, e.g. "interview/<id>", to open next.
export async function practiseFromBank(id, { questionIds, voice = false, codingMode = 'interview' }) {
  const data = await request(`/api/question-banks/${encodeURIComponent(id)}/practice`, {
    method: 'POST',
    body: JSON.stringify({ question_ids: questionIds, voice, coding_mode: codingMode }),
  })
  notifyRecentChanged()
  return data
}

// ---------------------------------------------------------------- evals (tests for the AI)

// { suites: [...], runs: [...] }: what each suite tests, and the latest runs (without their cases)
export function listEvals() {
  return request('/api/evals')
}

// One run with every case: what you expected and what the AI did.
export function getEval(id) {
  return request(`/api/evals/${encodeURIComponent(id)}`)
}

// Runs a suite ('grader' or 'judge') in the background. It calls the real AI.
export function runEval(suite) {
  return request('/api/evals', { method: 'POST', body: JSON.stringify({ suite }) })
}

// ---- Resume grind (backend/routes/resume_grind.py)
// { resume: {...} }, or { resume: null } before the first upload
export function getResume() {
  return request('/api/resume')
}

// The first resume, or a new version of it: a PDF file, or pasted text.
export function uploadResume({ file, text }) {
  const form = new FormData()
  if (file) form.append('file', file)
  else form.append('text', text)
  return request('/api/resume', { method: 'POST', body: form })
}

// count: 3, 5 or 8 lines · mode: 'text' or 'voice'. Returns the interview it started.
export async function startResumeGrind({ count, mode }) {
  const view = await request('/api/resume/grind', { method: 'POST', body: JSON.stringify({ count, mode }) })
  notifyRecentChanged()
  return view
}

export function deleteResume() {
  return request('/api/resume', { method: 'DELETE' })
}

// ---- Panel interview (backend/routes/panel.py)
export function listPanelists() {
  return request('/api/panels/panelists')
}

export function listPanels() {
  return request('/api/panels')
}

// form is a FormData: role, company, level, jd or jd_file, resume or resume_file, use_resume_grind,
// panelists (2 to 4 of them), num_questions, follow_ups
export async function startPanel(form) {
  const view = await request('/api/panels', { method: 'POST', body: form })
  notifyRecentChanged()
  return view
}

export function getPanel(id) {
  return request(`/api/panels/${encodeURIComponent(id)}`)
}

// Live: onStep('start', { id, node, who }) and onStep('finish', { id }) for every step while the panel works.
export async function answerPanelLive(id, answer, onStep) {
  const view = await streamRequest(`/api/panels/${encodeURIComponent(id)}/answer/live`, { answer }, onStep)
  notifyRecentChanged()
  return view
}

export async function endPanel(id) {
  const view = await request(`/api/panels/${encodeURIComponent(id)}/end`, { method: 'POST' })
  notifyRecentChanged()
  return view
}

export function retryPanel(id) {
  return request(`/api/panels/${encodeURIComponent(id)}/retry`, { method: 'POST' })
}
