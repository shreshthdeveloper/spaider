import { scoreClass } from '../../lib/format'
import AgentAvatar from '../bank/AgentAvatar'
import Icon from '../Icon'
import { decisionClass, nameOf } from './steps'

// The panel's decision, each panelist's vote and reasons, then the whole interview turn by turn, with the
// private notes the panel passed after every answer (revealed now).
export default function PanelReport({ panel }) {
  const report = panel.report || {}
  const answeredAny = panel.results.length > 0

  return (
    <div className="page interview-page panel-report">
      <header className="page-head">
        <div className="head-text">
          <div className="eyebrow">Panel report</div>
          <h1 className="topic-title">{panel.title}</h1>
        </div>
        <div className="row">
          <a className="button-link" href="#/panel/past">
            <Icon name="clock" size={16} />
            Past panels
          </a>
          <a className="button-link primary" href="#/panel">
            <Icon name="plus" size={16} />
            New panel
          </a>
        </div>
      </header>

      <section className="card report-hero">
        <div className={`panel-decision ${decisionClass(report.decision)}`}>
          <span className="small">The panel says</span>
          <b>{report.decision}</b>
          {report.votes && <span className="small">{report.votes} voted hire</span>}
        </div>
        <div className="report-body">
          {answeredAny && (
            <div className={`panel-overall ${scoreClass(report.overall)}`}>
              {report.overall}
              <span>/5 on the main questions</span>
            </div>
          )}
          <p className="report-summary">{report.summary}</p>
        </div>
      </section>

      {panel.verdicts.length > 0 && (
        <section className="verdict-grid">
          {panel.panel.map((panelist) => {
            const vote = panel.verdicts.find((v) => v.by === panelist.id)
            if (!vote) return null
            return (
              <div key={panelist.id} className="card verdict-card">
                <div className="verdict-head">
                  <AgentAvatar id={panelist.id} />
                  <span className="panelist-text">
                    <b>{panelist.name}</b>
                    <span className="muted small">{panelist.title}</span>
                  </span>
                  <span className={`chip verdict-chip ${decisionClass(vote.decision)}`}>{vote.decision}</span>
                </div>
                <ul className="verdict-reasons">
                  {vote.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {answeredAny && (
        <section className="panel-lists">
          <ReportList title="The panel agreed" icon="check" items={report.agreed} />
          <ReportList title="They saw it differently" icon="users" items={report.disagreed} empty="No disagreements." />
          <ReportList title="Work on next" icon="target" items={report.improve} />
        </section>
      )}

      {answeredAny && (
        <section className="card panel-turns">
          <h2>How it went, turn by turn</h2>
          {panel.results.map((result) => (
            <Turn key={result.turn} panel={panel} result={result} />
          ))}
        </section>
      )}
    </div>
  )
}

function ReportList({ title, icon, items = [], empty = 'Nothing here.' }) {
  return (
    <div className="card report-list">
      <h3>
        <Icon name={icon} size={15} />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One question and your answer: who asked and why, your score, what you covered and missed, and the notes
// the panelists wrote about it.
function Turn({ panel, result }) {
  const why = panel.decisions.find((d) => d.turn === result.turn - 1)
  const notes = panel.notes.filter((note) => note.turn === result.turn && note.note)
  return (
    <div className="panel-turn">
      <div className="turn-head">
        <AgentAvatar id={result.speaker} size="small" />
        <b>{nameOf(panel.panel, result.speaker)}</b>
        {result.kind === 'follow_up' && <span className="chip chip-follow">Follow-up</span>}
        <span className={`turn-score ${scoreClass(result.score)}`}>{result.score}/5</span>
      </div>
      {result.kind === 'follow_up' && why && <p className="panel-why small">Why: {why.reason}</p>}
      <p className="turn-question">{result.question}</p>
      <p className="turn-answer">{result.answer}</p>
      <div className="turn-points small">
        {result.covered.map((point) => (
          <span key={point} className="point covered">
            <Icon name="check" size={12} /> {point}
          </span>
        ))}
        {result.missed.map((point) => (
          <span key={point} className="point missed">
            <Icon name="x" size={12} /> {point}
          </span>
        ))}
      </div>
      {result.feedback && <p className="muted small">{result.feedback}</p>}
      {notes.length > 0 && (
        <details className="turn-notes">
          <summary className="small">What the panel whispered ({notes.length})</summary>
          {notes.map((note) => (
            <div key={note.by} className="panel-note">
              <AgentAvatar id={note.by} size="small" />
              <span>
                <b>{nameOf(panel.panel, note.by)}:</b> {note.note}
                {note.follow_up && <span className="note-wish"> Wanted to ask: “{note.follow_up}”</span>}
              </span>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
