import { lookOf } from '../../lib/agents'

// When each member of the panel worked, on one time axis (a small Gantt chart, from each step's runs).
// The agents' bars overlap because they ran in parallel. A dashed bar is time the panel waited for you.
export default function RunTimeline({ steps }) {
  const rows = steps.filter((step) => step.runs && step.runs.length > 0)
  if (rows.length === 0) return null

  // the run's first start and last end, in milliseconds
  let first = Infinity
  let last = 0
  for (const step of rows) {
    for (const run of step.runs) {
      const start = Date.parse(run.start)
      first = Math.min(first, start)
      last = Math.max(last, start + run.ms)
    }
  }
  const span = Math.max(last - first, 1)
  const ticks = tickMarks(span)
  const percent = (ms) => `${(ms / span) * 100}%`

  return (
    <section className="card timeline-card">
      <div className="timeline-head">
        <h2>Timeline</h2>
        <span className="muted small">Each bar is one piece of work. Overlapping bars ran at the same time.</span>
      </div>

      <div className="timeline">
        <div className="timeline-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: percent(tick) }} />
          ))}
        </div>

        {rows.map((step) => (
          <div key={step.id} className="timeline-row">
            <span className="timeline-name">{step.name}</span>
            <span className="timeline-track">
              {step.runs.map((run, i) => (
                <span
                  key={i}
                  className={`timeline-bar ${step.kind}${run.label === 'failed' ? ' failed' : ''}`}
                  style={{
                    left: percent(Date.parse(run.start) - first),
                    width: `max(4px, ${percent(run.ms)})`,
                    '--bar-color': lookOf(step.kind === 'agent' ? step.agent : step.kind === 'human' ? 'you' : step.id).color,
                  }}
                  title={`${step.name} · ${run.label} · ${(run.ms / 1000).toFixed(1)} s`}
                />
              ))}
            </span>
          </div>
        ))}

        <div className="timeline-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: percent(tick) }}>
              {Math.round(tick / 1000)} s
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// Round tick marks (in ms) for the axis: about 4 to 7 of them, every 1, 2, 5, 10, 15, 20, 30 or 60 s...
function tickMarks(spanMs) {
  const seconds = spanMs / 1000
  let step = 1
  for (const candidate of [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600]) {
    step = candidate
    if (seconds / candidate <= 6) break
  }
  const ticks = []
  for (let s = 0; s <= seconds; s += step) ticks.push(s * 1000)
  return ticks
}
