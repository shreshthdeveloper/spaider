import { useEffect, useRef, useState } from 'react'
import { QUESTION_TYPES } from '../../lib/agents'
import { createBank, listBankAgents, listBanks, listDocuments } from '../../lib/api'
import { go } from '../../lib/router'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import AgentAvatar from './AgentAvatar'
import BankTabs from './BankTabs'

// The same lists as routes/question_bank.py
const INTERVIEW_TYPES = ['Mixed', 'Technical', 'System design', 'Coding', 'Behavioural']
const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']

const MAX_DOCUMENTS = 3 // the same limit as routes/question_bank.py

const RUN_MODES = [
  { review: false, icon: 'bolt', title: 'Automatic', text: 'The panel runs start to end on its own.' },
  {
    review: true,
    icon: 'user',
    title: 'Review mode',
    text: 'Human in the loop: it pauses for you after the plan, and after the judge.',
  },
]

const HOW_IT_WORKS = [
  { icon: 'network', title: 'The panel lead reads everything', text: 'and gives each agent a brief, so they split the work.' },
  { icon: 'users', title: 'The agents write at the same time', text: 'each in its own area, with model answers.' },
  { icon: 'eye', title: 'The judge checks every question', text: 'drops repeats and weak ones, and can send one agent back.' },
  { icon: 'play', title: 'You practise', text: 'pick questions and start a mock interview, whiteboard or coding round.' },
]

// #/bank?topic=<topic> (a fly on the Stats page) fills in the topics.
function topicFromLink() {
  return new URLSearchParams(window.location.hash.split('?')[1] || '').get('topic') || ''
}

// Tab 1 of the question bank: the role, what the panel reads, and who is on the panel.
export default function BankSetup() {
  const [agents, setAgents] = useState(null) // from the backend; null = loading
  const [picked, setPicked] = useState([])
  const [pastCount, setPastCount] = useState(0)
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [interviewType, setInterviewType] = useState('Mixed')
  const [level, setLevel] = useState('Mid')
  const [topics, setTopics] = useState(topicFromLink)
  const [jd, setJd] = useState({ text: '', file: null })
  const [resume, setResume] = useState({ text: '', file: null })
  const [review, setReview] = useState(false)
  const [documents, setDocuments] = useState([]) // your uploaded PDFs (from the Documents page)
  const [searchable, setSearchable] = useState([]) // the ids of the ones the agents may search
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listBankAgents()
      .then((data) => {
        setAgents(data.agents)
        setPicked(data.agents.map((agent) => agent.id)) // everyone is on the panel to start with
      })
      .catch((err) => setError(err.message))
    listBanks()
      .then((data) => setPastCount(data.banks.length))
      .catch(() => {})
    listDocuments()
      .then((data) => setDocuments(data.documents))
      .catch(() => {})
  }, [])

  const chosen = (agents || []).filter((agent) => picked.includes(agent.id))
  const hasInput = position.trim() || topics.trim() || jd.text.trim() || jd.file || resume.text.trim() || resume.file
  const counts = { qa: 0, whiteboard: 0, coding: 0 }
  chosen.forEach((agent) => (counts[agent.makes] += agent.count))

  function toggle(id) {
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  }

  function toggleDocument(id) {
    if (searchable.includes(id)) setSearchable(searchable.filter((d) => d !== id))
    else if (searchable.length < MAX_DOCUMENTS) setSearchable([...searchable, id])
  }

  async function start() {
    if (!hasInput || !chosen.length || starting) return
    const form = new FormData()
    form.append('company', company.trim())
    form.append('position', position.trim())
    form.append('interview_type', interviewType)
    form.append('level', level)
    form.append('topics', topics.trim())
    if (jd.file) form.append('jd_file', jd.file)
    else form.append('jd', jd.text.trim())
    if (resume.file) form.append('resume_file', resume.file)
    else form.append('resume', resume.text.trim())
    chosen.forEach((agent) => form.append('agents', agent.id))
    searchable.forEach((documentId) => form.append('documents', documentId))
    if (review) form.append('review', 'true')

    setStarting(true)
    setError('')
    try {
      const bank = await createBank(form)
      go(`bank/${bank.id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="page interview-page bank-page">
      <BankTabs current="new" count={pastCount} />

      <div className="setup-layout">
        <div className="setup-form">
          {/* ---------- 1. the role ---------- */}
          <section className="card setup-card">
            <StepTitle number={1} title="The role">
              Who is interviewing you, and for what. All optional, but it helps the panel aim.
            </StepTitle>
            <div className="bank-fields">
              <label>
                <span className="field-label">Company</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="e.g. Damco" />
              </label>
              <label>
                <span className="field-label">Position</span>
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Forward Deployed AI Engineer"
                />
              </label>
            </div>
            <ChipChoice label="Interview type" options={INTERVIEW_TYPES} value={interviewType} onChange={setInterviewType} />
            <ChipChoice label="Level" options={LEVELS} value={level} onChange={setLevel} />
          </section>

          {/* ---------- 2. what the panel reads ---------- */}
          <section className="card setup-card">
            <StepTitle number={2} title="What should the panel read?">
              Paste text or upload a PDF. Questions that come from your own words get a badge.
            </StepTitle>
            <TextOrPdf
              label="Job description"
              value={jd}
              onChange={setJd}
              placeholder="Paste the job description…"
            />
            <TextOrPdf label="Your resume" value={resume} onChange={setResume} placeholder="Paste your resume…" />
            <label className="bank-topics">
              <span className="field-label">Topics you want covered</span>
              <input
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                maxLength={600}
                placeholder="e.g. Kafka, RAG, Python generators"
              />
            </label>
          </section>

          {/* ---------- 3. the panel ---------- */}
          <section className="card setup-card">
            <StepTitle number={3} title="Pick your panel">
              Each agent writes its own kind of question. They all work at the same time.
            </StepTitle>
            {agents === null && !error && <SpiderLoader size="small" label="Calling the panel…" />}
            <div className="agent-picks">
              {(agents || []).map((agent) => {
                const on = picked.includes(agent.id)
                const type = QUESTION_TYPES[agent.makes]
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={`agent-pick${on ? ' on' : ''}`}
                    onClick={() => toggle(agent.id)}
                    disabled={starting}
                    aria-pressed={on}
                  >
                    <AgentAvatar id={agent.id} />
                    <span className="agent-pick-text">
                      <span className="agent-pick-name">{agent.name}</span>
                      <span className="agent-pick-type">
                        <Icon name={type.icon} size={12} />
                        {agent.count} {type.label}
                      </span>
                      <span className="muted small">{agent.focus}</span>
                    </span>
                    <span className="mode-check">{on && <Icon name="check" size={13} />}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ---------- 4. how the panel works ---------- */}
          <section className="card setup-card">
            <StepTitle number={4} title="How should the panel work?">
              Choose who has the last word, and what the agents may look up.
            </StepTitle>
            <div className="mode-cards">
              {RUN_MODES.map((mode) => (
                <button
                  key={mode.title}
                  type="button"
                  className={`mode-card${review === mode.review ? ' on' : ''}`}
                  onClick={() => setReview(mode.review)}
                  aria-pressed={review === mode.review}
                >
                  <span className="mode-icon">
                    <Icon name={mode.icon} size={18} />
                  </span>
                  <span className="mode-text">
                    <span className="mode-title">{mode.title}</span>
                    <span className="muted small">{mode.text}</span>
                  </span>
                  <span className="mode-check">{review === mode.review && <Icon name="check" size={13} />}</span>
                </button>
              ))}
            </div>

            <div className="bank-docs">
              <span className="field-label">
                Documents the agents can search <span className="muted">(a tool, up to {MAX_DOCUMENTS})</span>
              </span>
              {documents.length === 0 && (
                <p className="muted small">
                  Upload a PDF on the <a href="#/docs">Documents</a> page (notes, a book chapter) and the agents can
                  search it before they write.
                </p>
              )}
              <div className="chips-row">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`chip-btn${searchable.includes(doc.id) ? ' on' : ''}`}
                    onClick={() => toggleDocument(doc.id)}
                    aria-pressed={searchable.includes(doc.id)}
                  >
                    <Icon name={searchable.includes(doc.id) ? 'check' : 'file'} size={13} />
                    {doc.filename}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ---------- summary + start ---------- */}
        <aside className="card summary-card">
          <div className="summary-head">
            <span className="eyebrow">Your panel</span>
          </div>
          <div className="panel-row" aria-label="The panel">
            <AgentAvatar id="coordinator" size="small" />
            <Icon name="arrow" size={14} />
            <span className="panel-row-agents">
              {chosen.map((agent) => (
                <span key={agent.id} title={agent.name}>
                  <AgentAvatar id={agent.id} size="small" />
                </span>
              ))}
              {!chosen.length && <span className="muted small">no agents yet</span>}
            </span>
            <Icon name="arrow" size={14} />
            <AgentAvatar id="judge" size="small" />
          </div>

          <dl className="summary-facts">
            {Object.entries(QUESTION_TYPES).map(([kind, type]) => (
              <div key={kind}>
                <dt>{type.label}</dt>
                <dd>about {counts[kind]}</dd>
              </div>
            ))}
            <div>
              <dt>Level</dt>
              <dd>{level}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{review ? 'Review' : 'Automatic'}</dd>
            </div>
            <div>
              <dt>Documents</dt>
              <dd>{searchable.length || 'none'}</dd>
            </div>
          </dl>

          <button className="primary big start-btn" onClick={start} disabled={!hasInput || !chosen.length || starting}>
            {starting ? (
              <>
                <span className="spinner small" />
                Calling the panel…
              </>
            ) : (
              <>
                <Icon name="users" size={16} />
                Assemble the panel
              </>
            )}
          </button>
          {!hasInput && <p className="muted small bank-hint">Add a position, topics, a job description or a resume.</p>}

          {error && (
            <div className="inline-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <ol className="how-list">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.title}>
                <span className="how-icon">
                  <Icon name={step.icon} size={15} />
                </span>
                <span>
                  <b>{step.title}</b>
                  <span className="muted small">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}

function StepTitle({ number, title, children }) {
  return (
    <div className="setup-step">
      <span className="step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p className="muted small">{children}</p>
      </div>
    </div>
  )
}

function ChipChoice({ label, options, value, onChange }) {
  return (
    <div className="bank-choice">
      <span className="field-label">{label}</span>
      <div className="chips-row">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip-btn${value === option ? ' on' : ''}`}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

// A text box, or a PDF instead of it. value = { text, file }.
function TextOrPdf({ label, value, onChange, placeholder }) {
  const fileRef = useRef(null)

  function pick(e) {
    const file = e.target.files?.[0]
    if (file) onChange({ ...value, file })
    e.target.value = '' // so picking the same file again still counts
  }

  return (
    <div className="text-or-pdf">
      <div className="text-or-pdf-head">
        <span className="field-label">{label}</span>
        <button type="button" className="small" onClick={() => fileRef.current.click()}>
          <Icon name="upload" size={14} />
          Upload PDF
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
      </div>
      {value.file ? (
        <div className="picked-file">
          <Icon name="file" size={16} />
          <span>{value.file.name}</span>
          <span className="muted small">{Math.max(1, Math.round(value.file.size / 1024))} KB</span>
          <button type="button" className="icon-btn" onClick={() => onChange({ ...value, file: null })} aria-label="Remove the file">
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <textarea
          rows={4}
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          maxLength={20000}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
