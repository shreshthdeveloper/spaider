import Icon from '../Icon'

// The top of the panel interview pages: the title, then "New panel | Past panels".
//   current  'new' | 'past'
//   count    how many past panels there are (left out while loading)
export default function PanelTabs({ current, count }) {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1>Panel interview</h1>
          <p className="muted">
            Three or four interviewers, one conversation. They take turns, follow up on each other, and pass private
            notes before they decide on you.
          </p>
        </div>
      </header>

      <nav className="page-tabs">
        <a href="#/panel" className={current === 'new' ? 'on' : ''}>
          <Icon name="plus" size={16} />
          New panel
        </a>
        <a href="#/panel/past" className={current === 'past' ? 'on' : ''}>
          <Icon name="clock" size={16} />
          Past panels
          {count > 0 && <span className="tab-count">{count}</span>}
        </a>
      </nav>
    </>
  )
}
