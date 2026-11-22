import { useEffect, useState } from 'react'
import { listPanels } from '../../lib/api'
import { formatDate, scoreClass } from '../../lib/format'
import AgentAvatar from '../bank/AgentAvatar'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import PanelTabs from './PanelTabs'
import { decisionClass } from './steps'

// Tab 2 of the panel interview: every panel so far, newest first, with its decision.
export default function PastPanels() {
  const [panels, setPanels] = useState(null) // null = still loading

  useEffect(() => {
    listPanels()
      .then((data) => setPanels(data.panels))
      .catch(() => setPanels([]))
  }, [])

  if (panels === null) {
    return (
      <div className="page interview-page">
        <PanelTabs current="past" />
        <SpiderLoader label="Loading your panels…" />
      </div>
    )
  }

  return (
    <div className="page interview-page">
      <PanelTabs current="past" count={panels.length} />
      {panels.length === 0 ? (
        <div className="card center-card">
          <span className="empty-icon">
            <Icon name="users" size={22} />
          </span>
          <h2>No panel interviews yet</h2>
          <p className="muted">Your panels and their decisions will show up here.</p>
          <a className="button-link primary" href="#/panel">
            <Icon name="play" size={16} />
            Start your first panel
          </a>
        </div>
      ) : (
        <section className="card past-card">
          <div className="past-list">
            {panels.map((item) => (
              <a key={item.id} className="past-row" href={`#/panel/${item.id}`}>
                <span className="panel-faces small-faces">
                  {item.panelist_ids.map((id) => (
                    <AgentAvatar key={id} id={id} size="small" />
                  ))}
                </span>
                <span className="past-text">
                  <span className="past-topic">{item.title}</span>
                  <span className="past-meta muted small">
                    {formatDate(item.created_at)} · {item.num_questions} questions
                  </span>
                </span>
                {item.status === 'finished' ? (
                  <>
                    <span className={`chip verdict-chip ${decisionClass(item.decision)}`}>{item.decision}</span>
                    {item.overall !== null && <span className={`turn-score ${scoreClass(item.overall)}`}>{item.overall}/5</span>}
                  </>
                ) : (
                  <span className="chip">In progress</span>
                )}
                <Icon name="chevron" size={16} />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
