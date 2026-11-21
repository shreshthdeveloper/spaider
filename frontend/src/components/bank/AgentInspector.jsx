import { lookOf, QUESTION_TYPES, RUBRIC } from '../../lib/agents'
import Modal from '../Modal'
import AgentAvatar from './AgentAvatar'
import { ScoreChips } from './ReviewPanel'

// A side panel with everything about one card of the pipeline: what it was told, what it searched,
// every question it wrote (kept or dropped, with the judge's scores) and how long each run took.
//   stepId  the card to show (null = closed); bank  the bank it belongs to
export default function AgentInspector({ stepId, bank, onClose }) {
  const step = bank.steps.find((s) => s.id === stepId)
  return (
    <Modal open={Boolean(step)} side title={step ? step.name : ''} subtitle={step ? roleOf(step) : ''} onClose={onClose}>
      {step && <InspectorBody step={step} bank={bank} />}
    </Modal>
  )
}

function InspectorBody({ step, bank }) {
  const face = step.kind === 'agent' ? step.agent : step.kind === 'human' ? 'you' : step.id
  return (
    <div className="inspector">
      <div className="inspector-top">
        <AgentAvatar id={face} />
        <div>
          <div className="step-name">{step.name}</div>
          <div className="muted small">
            {statusText(step)} · {runsText(step.runs)}
          </div>
        </div>
      </div>

      {step.kind === 'coordinator' && <LeadDetails bank={bank} />}
      {step.kind === 'agent' && <AgentDetails step={step} bank={bank} />}
      {step.kind === 'judge' && <JudgeDetails bank={bank} />}
      {step.kind === 'human' && (
        <Section title="What you decided">
          <p>{step.note || 'Nothing yet.'}</p>
        </Section>
      )}

      {step.runs && step.runs.length > 0 && (
        <Section title="Runs">
          <ul className="inspector-runs">
            {step.runs.map((run, i) => (
              <li key={i}>
                <span>{run.label}</span>
                <span className="muted">{(run.ms / 1000).toFixed(1)} s</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

function LeadDetails({ bank }) {
  const agents = bank.steps.filter((step) => step.kind === 'agent')
  return (
    <>
      <Section title="The plan">
        <p>{bank.plan || 'Still reading your inputs…'}</p>
      </Section>
      <Section title="Briefs it wrote">
        {agents.map((step) => (
          <div key={step.agent} className="inspector-brief">
            <span className="q-dot" style={{ background: lookOf(step.agent).color }} />
            <span>
              <b>{step.name}:</b> {step.brief || '…'}
            </span>
          </div>
        ))}
      </Section>
    </>
  )
}

function AgentDetails({ step, bank }) {
  const judge = bank.steps.find((s) => s.kind === 'judge')
  const sentBack = judge && judge.sent_back && judge.sent_back.agent === step.agent ? judge.sent_back : null
  const kept = bank.questions.filter((q) => q.agent === step.agent)
  const dropped = bank.dropped.filter((q) => q.agent === step.agent)

  return (
    <>
      <Section title="Brief from the panel lead">
        <p>{step.brief || 'Waiting for the plan…'}</p>
      </Section>

      {sentBack && (
        <Section title={sentBack.blocked ? 'The judge wanted it rewritten (you blocked it)' : "The judge's note"}>
          <p className="inspector-judge-note">{sentBack.note}</p>
        </Section>
      )}

      {step.searches && step.searches.length > 0 && (
        <Section title="Searched your documents (tool calls)">
          <ul className="inspector-list">
            {step.searches.map((search, i) => (
              <li key={i}>
                <b>“{search.query}”</b>
                <span className="muted small"> → {search.found.length ? search.found.join(', ') : 'nothing relevant'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Questions it wrote (${kept.length} kept)`}>
        {bank.status !== 'done' && kept.length === 0 && <p className="muted small">They show here when the panel is done.</p>}
        <ul className="inspector-list">
          {kept.map((question) => (
            <li key={question.id}>
              <span className="q-type">{QUESTION_TYPES[question.type].label}</span> {question.question}
              <ScoreChips scores={question.scores} />
            </li>
          ))}
        </ul>
      </Section>

      {dropped.length > 0 && (
        <Section title={`Dropped (${dropped.length})`}>
          <ul className="inspector-list">
            {dropped.map((question) => (
              <li key={question.id} className="dropped">
                {question.question}
                <span className="muted small"> · {question.reason}</span>
                <ScoreChips scores={question.scores} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

function JudgeDetails({ bank }) {
  const judge = bank.steps.find((s) => s.kind === 'judge')
  const agents = bank.steps.filter((step) => step.kind === 'agent' && step.status !== 'skipped')
  return (
    <>
      <Section title="Verdict">
        <p>{bank.summary || 'Still judging…'}</p>
      </Section>
      <Section title="How it judges (LLM as a judge)">
        <p className="small">
          It scores every question from 1 to 5 on {RUBRIC.map((item) => item.label.toLowerCase()).join(', ')}. Then the{' '}
          <b>code</b>, not the AI, drops any question scoring 2 or less, or repeating an earlier one (at most 40% of
          the bank). It can send one agent back once, with a note.
        </p>
      </Section>
      {judge.sent_back && (
        <Section title="Send-back">
          <p className="inspector-judge-note">
            {judge.sent_back.blocked ? '(Blocked by you) ' : ''}
            {judge.sent_back.note}
          </p>
        </Section>
      )}
      <Section title="Average score by agent">
        <table className="inspector-table">
          <thead>
            <tr>
              <th>Agent</th>
              {RUBRIC.map((item) => (
                <th key={item.id}>{item.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((step) => (
              <tr key={step.agent}>
                <td>{step.name}</td>
                {RUBRIC.map((item) => (
                  <td key={item.id}>{averageScore(bank, step.agent, item.id)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  )
}

function Section({ title, children }) {
  return (
    <section className="inspector-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  )
}

// One agent's average for one rubric item, over every question it wrote (kept and dropped).
function averageScore(bank, agentId, item) {
  const values = []
  for (const question of [...bank.questions, ...bank.dropped]) {
    if (question.agent === agentId && question.scores) values.push(question.scores[item])
  }
  if (values.length === 0) return '–'
  const sum = values.reduce((total, value) => total + value, 0)
  return (sum / values.length).toFixed(1)
}

function roleOf(step) {
  if (step.kind === 'agent') return 'Panel agent'
  return lookOf(step.kind === 'human' ? 'you' : step.id).role || ''
}

function statusText(step) {
  const texts = {
    waiting: 'Waiting',
    thinking: 'Thinking',
    revising: 'Rewriting',
    needs_you: 'Waiting for you',
    done: 'Done',
    failed: 'Failed',
    skipped: 'Taken off the panel',
  }
  return texts[step.status] || step.status
}

function runsText(runs) {
  if (!runs || runs.length === 0) return 'no runs yet'
  let total = 0
  for (const run of runs) total += run.ms
  return `${runs.length} ${runs.length === 1 ? 'run' : 'runs'}, ${(total / 1000).toFixed(1)} s`
}
