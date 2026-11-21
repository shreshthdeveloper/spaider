import Icon from '../Icon'

// The top of the question bank pages: the title, then "New bank | Past banks".
//   current  'new' | 'past' | '' (a bank is open)
//   count    how many past banks there are (left out while loading)
export default function BankTabs({ current, count }) {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Practice</div>
          <h1>Question bank</h1>
          <p className="muted">A panel of AI agents reads your JD and resume, writes questions in parallel, and a judge checks them.</p>
        </div>
      </header>

      <nav className="page-tabs">
        <a href="#/bank" className={current === 'new' ? 'on' : ''}>
          <Icon name="plus" size={16} />
          New bank
        </a>
        <a href="#/bank/past" className={current === 'past' ? 'on' : ''}>
          <Icon name="clock" size={16} />
          Past banks
          {count > 0 && <span className="tab-count">{count}</span>}
        </a>
      </nav>
    </>
  )
}
