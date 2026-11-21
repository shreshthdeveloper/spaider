import Icon from '../Icon'

// The top of both mock interview tabs: the title, then "New interview | Past interviews".
// The tabs are plain links (#/interview and #/interview/past), so the browser's back button works.
//   current  'new' or 'past'
//   count    how many past interviews there are (left out while loading)
export default function InterviewTabs({ current, count }) {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1>Mock interview</h1>
          <p className="muted">A real interview loop: questions, follow-ups and an honest report.</p>
        </div>
      </header>

      <nav className="page-tabs">
        <a href="#/interview" className={current === 'new' ? 'on' : ''}>
          <Icon name="plus" size={16} />
          New interview
        </a>
        <a href="#/interview/past" className={current === 'past' ? 'on' : ''}>
          <Icon name="clock" size={16} />
          Past interviews
          {count > 0 && <span className="tab-count">{count}</span>}
        </a>
      </nav>
    </>
  )
}
