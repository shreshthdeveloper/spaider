import { useEffect, useState } from 'react'
import { listInterviews } from '../../lib/api'
import { formatDate, plural, scoreClass } from '../../lib/format'
import Icon from '../Icon'
import SpiderLoader from '../SpiderLoader'
import InterviewTabs from './InterviewTabs'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'finished', label: 'Finished' },
  { id: 'progress', label: 'In progress' },
]

const CHART_BARS = 12 // the chart shows this many latest finished interviews

// Tab 2 of the mock interview: your numbers, a score chart and every past interview.
export default function PastInterviews() {
  const [past, setPast] = useState(null) // null = still loading
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    listInterviews()
      .then((data) => setPast(data.interviews))
      .catch(() => setPast([]))
  }, [])

  if (past === null) {
    return (
      <div className="page interview-page">
        <InterviewTabs current="past" />
        <SpiderLoader label="Loading your interviews…" />
      </div>
    )
  }

  if (past.length === 0) {
    return (
      <div className="page interview-page">
        <InterviewTabs current="past" count={0} />
        <div className="card center-card">
          <span className="empty-icon">
            <Icon name="clock" size={22} />
          </span>
          <h2>No interviews yet</h2>
          <p className="muted">Your interviews and scores will show up here.</p>
          <a className="button-link primary" href="#/interview">
            <Icon name="play" size={16} />
            Start your first interview
          </a>
        </div>
      </div>
    )
  }

  // Newest first, as the backend sends them. Scored = finished and has a score.
  const scored = past.filter((item) => item.status === 'finished' && item.overall !== null)
  const words = search.trim().toLowerCase()
  const shown = past.filter((item) => {
    if (filter === 'finished' && item.status !== 'finished') return false
    if (filter === 'progress' && item.status === 'finished') return false
    return !words || item.topic.toLowerCase().includes(words)
  })

  return (
    <div className="page interview-page">
      <InterviewTabs current="past" count={past.length} />

      <Stats interviews={past} scored={scored} />

      <div className="past-layout">
        <section className="card past-card">
          <div className="past-toolbar">
            <h2>All interviews</h2>
            <div className="seg">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search topics"
                aria-label="Search topics"
              />
            </label>
          </div>

          {shown.length === 0 && <p className="muted no-match">No interviews match.</p>}
          <div className="past-list">
            {shown.map((item) => (
              <PastRow key={item.id} item={item} />
            ))}
          </div>
        </section>

        <ScoreChart scored={scored.slice(0, CHART_BARS).reverse()} />
      </div>
    </div>
  )
}

// Four numbers at the top.
function Stats({ interviews, scored }) {
  const inProgress = interviews.filter((item) => item.status !== 'finished').length
  let average = '–'
  let best = '–'
  if (scored.length > 0) {
    const sum = scored.reduce((total, item) => total + item.overall, 0)
    average = `${Math.round((sum / scored.length) * 10) / 10}/5`
    best = `${Math.max(...scored.map((item) => item.overall))}/5`
  }

  const tiles = [
    { icon: 'check', value: scored.length, label: 'Interviews finished' },
    { icon: 'chart', value: average, label: 'Average score' },
    { icon: 'trophy', value: best, label: 'Best score' },
    { icon: 'clock', value: inProgress, label: 'In progress' },
  ]

  return (
    <div className="stats">
      {tiles.map((tile) => (
        <div key={tile.label} className="stat">
          <span className="stat-icon">
            <Icon name={tile.icon} size={16} />
          </span>
          <div>
            <div className="stat-value">{tile.value}</div>
            <div className="muted small">{tile.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// One bar per finished interview, oldest on the left. Bar height = score out of 5.
// Hover a bar to see which interview it is; the list next to it has the full details.
function ScoreChart({ scored }) {
  const [hovered, setHovered] = useState(null) // index of the bar under the mouse

  if (scored.length === 0) {
    return (
      <section className="card chart-card">
        <h2>Score trend</h2>
        <p className="muted small">Finish an interview to see your scores here.</p>
      </section>
    )
  }

  // Drawing area in SVG units. left = room for the 0 and 5 labels; top = room for the label on the last bar.
  const width = 320
  const height = 170
  const left = 22
  const top = 18
  const bottom = 6
  const plotWidth = width - left
  const plotHeight = height - top - bottom
  const slot = plotWidth / scored.length
  const barWidth = Math.min(24, slot - 6)
  const y = (score) => top + plotHeight - (score / 5) * plotHeight

  const last = scored.length - 1
  const tip = hovered === null ? null : scored[hovered]
  // Where the tooltip goes, in % of the chart width. Kept away from the edges so it stays inside the card.
  const tipLeft = hovered === null ? 0 : Math.min(78, Math.max(22, ((left + (hovered + 0.5) * slot) / width) * 100))

  return (
    <section className="card chart-card">
      <h2>Score trend</h2>
      <p className="muted small">
        Your last {plural(scored.length, 'finished interview')}, oldest first.
      </p>

      <div className="chart-box" onMouseLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Scores of your last ${scored.length} finished interviews`}>
          {[0, 1, 2, 3, 4, 5].map((score) => (
            <line key={score} className={score === 0 ? 'chart-base' : 'chart-grid'} x1={left} x2={width} y1={y(score)} y2={y(score)} />
          ))}
          <text className="chart-axis" x={left - 8} y={y(5) + 4} textAnchor="end">5</text>
          <text className="chart-axis" x={left - 8} y={y(0) + 4} textAnchor="end">0</text>

          {scored.map((item, i) => {
            const x = left + i * slot + (slot - barWidth) / 2
            const barTop = Math.min(y(item.overall), y(0) - 2) // a 0 still shows as a thin line
            return (
              <g key={item.id}>
                <path className={`chart-bar${hovered === i ? ' on' : ''}`} d={roundedTopBar(x, barTop, barWidth, y(0) - barTop)} />
                {/* a hit area as tall as the chart, so thin bars are easy to hover */}
                <rect
                  x={left + i * slot}
                  y={top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
                {i === last && hovered === null && (
                  <text className="chart-label" x={x + barWidth / 2} y={barTop - 6} textAnchor="middle">
                    {item.overall}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {tip && (
          <div className="chart-tip" style={{ left: `${tipLeft}%` }}>
            <b>{tip.overall}/5</b>
            <span>{tip.topic}</span>
            <span className="muted">{formatDate(tip.created_at)}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// A bar with its top corners rounded (4 px) and a flat bottom on the baseline.
function roundedTopBar(x, y, width, height) {
  const r = Math.min(4, width / 2, height)
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
}

function PastRow({ item }) {
  const finished = item.status === 'finished'
  return (
    <a className="past-row" href={`#/interview/${item.id}`}>
      <span className={`past-icon${finished ? ' done' : ''}`}>
        <Icon name={finished ? 'check' : 'clock'} size={16} />
      </span>
      <span className="past-text">
        <span className="past-topic">{item.topic}</span>
        <span className="muted small past-meta">
          {formatDate(item.created_at)} · {plural(item.num_questions || 0, 'question')} ·{' '}
          <Icon name={item.mode === 'voice' ? 'mic' : 'chat'} size={12} /> {item.mode === 'voice' ? 'Voice' : 'Text'}
        </span>
      </span>
      {finished ? (
        <span className={`badge ${scoreClass(item.overall)}`}>{item.overall}/5</span>
      ) : (
        <span className="badge badge-progress">Continue</span>
      )}
      <Icon name="chevron" size={16} className="past-chevron" />
    </a>
  )
}
