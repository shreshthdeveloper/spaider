// The last four weeks, one square per day (Monday first). The darker the square, the more you did.
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function dayLabel(day) {
  return new Date(`${day}T00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function doneText(count) {
  if (count === 0) return 'nothing'
  return count === 1 ? '1 thing done' : `${count} things done`
}

export default function ActivityCalendar({ cells, today }) {
  const activeDays = cells.filter((cell) => cell.count > 0).length

  return (
    <div className="calendar">
      <div className="calendar-grid" role="img" aria-label={`Last ${cells.length} days: you practised on ${activeDays}`}>
        {WEEKDAYS.map((name, i) => (
          <span key={`w${i}`} className="calendar-weekday">
            {name}
          </span>
        ))}
        {cells.map((cell) => (
          <span
            key={cell.day}
            className={`calendar-cell level-${Math.min(cell.count, 3)}${cell.day === today ? ' today' : ''}`}
            title={`${dayLabel(cell.day)}: ${doneText(cell.count)}`}
          />
        ))}
      </div>
      <div className="calendar-legend" aria-hidden="true">
        Less
        {[0, 1, 2, 3].map((level) => (
          <span key={level} className={`calendar-cell level-${level}`} />
        ))}
        More
      </div>
    </div>
  )
}
