import Icon from '../components/Icon'
import SpiderLoader from '../components/SpiderLoader'
import ActivityCalendar from '../components/stats/ActivityCalendar'
import SpiderWeb from '../components/stats/SpiderWeb'
import { MOODS } from '../lib/moods'
import { useStats } from '../lib/useStats'

// The finished rounds, as tiles under the streak.
const ROUND_TILES = [
  { kind: 'interview', label: 'Interviews', icon: 'target' },
  { kind: 'coding', label: 'Coding rounds', icon: 'code' },
  { kind: 'whiteboard', label: 'Whiteboards', icon: 'pen' },
]

const FLY_ICONS = { today: 'flag', bank: 'layers', unfinished: 'clock', weak: 'target' }

// #/stats: your spider's health, your streak, and the web of tasks waiting for you.
// It only shows data; everything on it is worked out by GET /api/stats.
export default function StatsPage() {
  const { stats, failed } = useStats()

  if (!stats) {
    return (
      <div className="page">
        {failed ? (
          <p className="inline-error">Couldn't load your stats. Is the backend running?</p>
        ) : (
          <SpiderLoader label="Weaving your web…" />
        )}
      </div>
    )
  }

  const { streak, health, totals } = stats

  return (
    <div className="page stats-page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Stats</div>
          <h1>Your web</h1>
          <p className="muted">
            Whatever you skip gets caught in your web. Clear it, and practise a little every day, to keep your spider happy.
          </p>
        </div>
      </header>

      <div className="stats-grid">
        <section className="card web-card">
          <SpiderWeb flies={stats.web} mood={health.mood} />
          <MoodPanel health={health} />
        </section>

        <div className="stats-side">
          <section className="card streak-card">
            <div className="streak-hero">
              <span className={`streak-flame${streak.current > 0 ? ' lit' : ''}`}>
                <Icon name="flame" size={26} />
              </span>
              <span className="streak-number">{streak.current}</span>
              <span className="streak-unit">day streak</span>
            </div>
            <div className="muted small">
              Best: {streak.best} {streak.best === 1 ? 'day' : 'days'} ·{' '}
              {streak.done_today ? 'today is done' : 'today is not done yet'}
            </div>
            <h3 className="section-title">Last 4 weeks</h3>
            <ActivityCalendar cells={stats.calendar} today={stats.today} />
          </section>

          <section className="card totals-card">
            {ROUND_TILES.map((tile) => (
              <RoundTile key={tile.kind} tile={tile} total={totals[tile.kind]} />
            ))}
            <div className="total-tile">
              <span className="total-label">
                <Icon name="layers" size={14} />
                Question banks
              </span>
              <span className="total-number">{totals.banks}</span>
              <span className="muted small">made by the agent panel</span>
            </div>
          </section>
        </div>
      </div>

      <section className="card web-list">
        <h2>On your web</h2>
        {stats.web.map((fly) => (
          <a key={fly.id} className={`web-task${fly.done ? ' done' : ''}`} href={`#/${fly.link}`}>
            <span className={`web-task-icon fly-${fly.kind}`}>
              <Icon name={fly.done ? 'check' : FLY_ICONS[fly.kind] || 'target'} size={16} />
            </span>
            <span className="web-task-text">
              <span className="web-task-title">{fly.title}</span>
              <span className="muted small">{fly.detail}</span>
            </span>
            {!fly.done && <Icon name="chevron" size={16} />}
          </a>
        ))}
      </section>
    </div>
  )
}

// Her mood, her health out of 100, and every reason she lost points.
function MoodPanel({ health }) {
  const mood = MOODS[health.mood]
  return (
    <div className={`mood-panel mood-${health.mood}`}>
      <div className="mood-head">
        <span className="mood-name">{mood.name}</span>
        <span className="muted">{mood.line}</span>
        <span className="mood-score">{health.score}/100</span>
      </div>
      <div className="health-bar" role="meter" aria-label="Spider health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health.score}>
        <span style={{ width: `${health.score}%` }} />
      </div>
      {health.reasons.length > 0 ? (
        <ul className="mood-reasons">
          {health.reasons.map((reason) => (
            <li key={reason.text}>
              <span>{reason.text}</span>
              <span className="mood-cost">−{reason.points}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nothing is costing her health. Keep it up!</p>
      )}
    </div>
  )
}

function RoundTile({ tile, total }) {
  return (
    <div className="total-tile">
      <span className="total-label">
        <Icon name={tile.icon} size={14} />
        {tile.label}
      </span>
      <span className="total-number">{total.finished}</span>
      <span className="muted small">
        {total.average === null ? 'none finished yet' : `average ${total.average} · best ${total.best} / 5`}
      </span>
    </div>
  )
}
