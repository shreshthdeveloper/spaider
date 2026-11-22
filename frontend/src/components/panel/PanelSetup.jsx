import { useEffect, useState } from 'react'
import { getResume, listPanelists, listPanels, startPanel } from '../../lib/api'
import { go } from '../../lib/router'
import AgentAvatar from '../bank/AgentAvatar'
import { ChipChoice, StepTitle, TextOrPdf } from '../bank/BankSetup'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import PanelTabs from './PanelTabs'

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']
const QUESTION_COUNTS = ['4', '6', '8']
const FOLLOW_UPS = ['0', '1', '2']
const MODES = { 'Video call': 'voice', 'Text chat': 'text' } // what you see -> what the backend gets
const DEFAULT_PANEL = ['tech_lead', 'hiring_manager', 'resume']
const MIN_PANEL = 2
const MAX_PANEL = 4

const HOW_IT_WORKS = [
  { icon: 'layers', title: 'The panel splits the work', text: 'each panelist gets their own questions from your JD and resume.' },
  { icon: 'users', title: 'One question at a time', text: 'they take turns, and follow up on your answer or on each other.' },
  { icon: 'eye', title: 'Private notes', text: 'after every answer, each one writes a note the others read.' },
  { icon: 'flag', title: 'A real decision', text: 'everyone votes hire or no hire, then the panel explains why.' },
]

// " · Sophie goes after your 3 weak lines first" (name = the resume panelist's name)
function weakLinesText(count, name, onPanel) {
  if (count === 0) return ' · no weak lines yet'
  const lines = `${count} weak line${count === 1 ? '' : 's'}`
  return onPanel ? ` · ${name} goes after your ${lines} first` : ` · add ${name} to the panel to test your ${lines}`
}

// Tab 1 of the panel interview: the role, what the panel reads, and who sits on it.
export default function PanelSetup() {
  const [panelists, setPanelists] = useState(null)
  const [pastCount, setPastCount] = useState(0)
  const [grindResume, setGrindResume] = useState(null) // your Resume grind resume, if you uploaded one
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [level, setLevel] = useState('Mid')
  const [jd, setJd] = useState({ text: '', file: null })
  const [resume, setResume] = useState({ text: '', file: null })
  const [useGrind, setUseGrind] = useState(true)
  const [picked, setPicked] = useState(DEFAULT_PANEL)
  const [questions, setQuestions] = useState('6')
  const [followUps, setFollowUps] = useState('1')
  const [mode, setMode] = useState('Video call')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listPanelists()
      .then((data) => setPanelists(data.panelists))
      .catch((err) => setError(err.message))
    listPanels()
      .then((data) => setPastCount(data.panels.length))
      .catch(() => {})
    getResume()
      .then((data) => setGrindResume(data.resume))
      .catch(() => {})
  }, [])

  const usingGrind = Boolean(grindResume) && useGrind
  const weakLines = grindResume ? grindResume.claims.filter((c) => c.level === 'red' || c.level === 'yellow').length : 0
  const hasInput = role.trim() || jd.text.trim() || jd.file
  const panelOk = picked.length >= MIN_PANEL && picked.length <= MAX_PANEL
  const chosen = (panelists || []).filter((p) => picked.includes(p.id))
  const resumeName = (panelists || []).find((p) => p.id === 'resume')?.name || 'the resume panelist'

  function toggle(id) {
    if (picked.includes(id)) setPicked(picked.filter((p) => p !== id))
    else if (picked.length < MAX_PANEL) setPicked([...picked, id])
  }

  async function start() {
    const form = new FormData()
    form.append('role', role.trim())
    form.append('company', company.trim())
    form.append('level', level)
    form.append('jd', jd.text)
    if (jd.file) form.append('jd_file', jd.file)
    if (usingGrind) {
      form.append('use_resume_grind', 'yes')
    } else {
      form.append('resume', resume.text)
      if (resume.file) form.append('resume_file', resume.file)
    }
    for (const id of picked) form.append('panelists', id)
    form.append('num_questions', questions)
    form.append('follow_ups', followUps)
    form.append('mode', MODES[mode])

    setStarting(true)
    setError('')
    try {
      const panel = await startPanel(form)
      go(`panel/${panel.id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="page interview-page bank-page">
      <PanelTabs current="new" count={pastCount} />

      <div className="setup-layout">
        <div className="setup-form">
          {/* ---------- 1. the role ---------- */}
          <section className="card setup-card">
            <StepTitle number={1} title="The role">
              What the panel is hiring for. A role or a job description is needed.
            </StepTitle>
            <div className="bank-fields">
              <label>
                <span className="field-label">Role</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="e.g. Forward Deployed AI Engineer" />
              </label>
              <label>
                <span className="field-label">Company</span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="e.g. Damco" />
              </label>
            </div>
            <ChipChoice label="Level" options={LEVELS} value={level} onChange={setLevel} />
          </section>

          {/* ---------- 2. what the panel reads ---------- */}
          <section className="card setup-card">
            <StepTitle number={2} title="What should the panel read?">
              Every panelist reads the same JD and resume. Contact details are taken out of the resume first.
            </StepTitle>
            <TextOrPdf label="Job description" value={jd} onChange={setJd} placeholder="Paste the job description…" />
            {grindResume && (
              <label className="grind-link">
                <input type="checkbox" checked={useGrind} onChange={(e) => setUseGrind(e.target.checked)} />
                <span>
                  <b>Use my Resume grind resume</b>
                  <span className="muted small">{weakLinesText(weakLines, resumeName, picked.includes('resume'))}</span>
                </span>
              </label>
            )}
            {!usingGrind && <TextOrPdf label="Your resume" value={resume} onChange={setResume} placeholder="Paste your resume…" />}
          </section>

          {/* ---------- 3. the panel ---------- */}
          <section className="card setup-card">
            <StepTitle number={3} title="Who sits on the panel?">
              Pick {MIN_PANEL} to {MAX_PANEL}. Each one asks about their own focus, in turns.
            </StepTitle>
            {panelists === null && !error && <SpiderLoader size="small" label="Calling the panel…" />}
            <div className="agent-picks">
              {(panelists || []).map((panelist) => {
                const on = picked.includes(panelist.id)
                return (
                  <button
                    key={panelist.id}
                    type="button"
                    className={`agent-pick${on ? ' on' : ''}`}
                    onClick={() => toggle(panelist.id)}
                    disabled={starting || (!on && picked.length >= MAX_PANEL)}
                    aria-pressed={on}
                  >
                    <AgentAvatar id={panelist.id} />
                    <span className="agent-pick-text">
                      <span className="agent-pick-name">{panelist.name}</span>
                      <span className="agent-pick-type">{panelist.title}</span>
                      <span className="muted small">{panelist.focus}</span>
                    </span>
                    <span className="mode-check">{on && <Icon name="check" size={13} />}</span>
                  </button>
                )
              })}
            </div>
            <div className="panel-choices">
              <ChipChoice label="Main questions (whole panel)" options={QUESTION_COUNTS} value={questions} onChange={setQuestions} />
              <ChipChoice label="Follow-ups after each" options={FOLLOW_UPS} value={followUps} onChange={setFollowUps} />
              <ChipChoice label="How you meet them" options={Object.keys(MODES)} value={mode} onChange={setMode} />
            </div>
          </section>
        </div>

        {/* ---------- summary + start ---------- */}
        <aside className="card summary-card">
          <div className="summary-head">
            <span className="eyebrow">Your panel</span>
          </div>
          <div className="panel-faces">
            {chosen.map((panelist) => (
              <span key={panelist.id} className="panel-face">
                <AgentAvatar id={panelist.id} />
                <span className="small">{panelist.name}</span>
              </span>
            ))}
            {!chosen.length && <span className="muted small">nobody yet</span>}
          </div>

          <dl className="summary-facts">
            <div>
              <dt>Main questions</dt>
              <dd>{questions}</dd>
            </div>
            <div>
              <dt>Follow-ups after each</dt>
              <dd>up to {followUps}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{mode}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{level}</dd>
            </div>
            <div>
              <dt>Resume</dt>
              <dd>{usingGrind ? 'Resume grind' : resume.file || resume.text.trim() ? 'given' : 'none'}</dd>
            </div>
          </dl>

          <button className="primary big start-btn" onClick={start} disabled={!hasInput || !panelOk || starting}>
            {starting ? (
              <>
                <span className="spinner small" />
                The panel is reading your JD…
              </>
            ) : (
              <>
                <Icon name="users" size={16} />
                Start the panel interview
              </>
            )}
          </button>
          {!hasInput && <p className="muted small bank-hint">Add a role or a job description.</p>}
          {hasInput && !panelOk && <p className="muted small bank-hint">Pick 2 to 4 panelists.</p>}

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
