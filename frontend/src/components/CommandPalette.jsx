import { useEffect, useRef, useState } from 'react'
import { listBanks, listCodingRounds, listDocuments, listInterviews, listWhiteboards } from '../lib/api'
import { go } from '../lib/router'
import { setThemeChoice } from '../lib/theme'
import Icon from './Icon'

// ⌘K (Ctrl+K on Windows), or the sidebar's search button: a box to jump anywhere.
// Type to filter, ↑ ↓ to move, Enter to open, Esc to close. It lists the pages, a few actions,
// and your recent interviews, banks, rounds and documents (loaded each time it opens).

const PAGES = [
  { label: 'Mock interview', icon: 'target', page: 'interview' },
  { label: 'Question bank', icon: 'layers', page: 'bank' },
  { label: 'Resume grind', icon: 'idcard', page: 'resume' },
  { label: 'Panel interview', icon: 'users', page: 'panel' },
  { label: 'Past panel interviews', icon: 'clock', page: 'panel/past' },
  { label: 'Whiteboard', icon: 'pen', page: 'whiteboard' },
  { label: 'Coding round', icon: 'code', page: 'coding' },
  { label: 'Documents', icon: 'file', page: 'docs' },
  { label: 'Stats', icon: 'web', page: 'stats' },
  { label: 'Evals', icon: 'chart', page: 'evals' },
  { label: 'AI traces', icon: 'bolt', page: 'traces' },
  { label: 'Past interviews', icon: 'clock', page: 'interview/past' },
  { label: 'Past question banks', icon: 'clock', page: 'bank/past' },
]

const THEMES = [
  { label: 'Theme: light', icon: 'sun', choice: 'light' },
  { label: 'Theme: dark', icon: 'moon', choice: 'dark' },
  { label: 'Theme: follow my computer', icon: 'monitor', choice: 'system' },
]

const RECENT_PER_KIND = 8
const MAX_SHOWN = 40

// Every fixed item: the pages, then the actions.
function fixedItems() {
  const items = []
  for (const page of PAGES) {
    items.push({ id: `page-${page.page}`, group: 'Pages', label: page.label, hint: 'Page', icon: page.icon, page: page.page })
  }
  items.push({ id: 'new-interview', group: 'Actions', label: 'Start a new interview', hint: 'Action', icon: 'plus', page: 'interview' })
  items.push({ id: 'new-bank', group: 'Actions', label: 'Make a question bank', hint: 'Action', icon: 'users', page: 'bank' })
  items.push({ id: 'upload', group: 'Actions', label: 'Upload a document', hint: 'Action', icon: 'upload', page: 'docs' })
  for (const theme of THEMES) {
    items.push({ id: `theme-${theme.choice}`, group: 'Actions', label: theme.label, hint: 'Action', icon: theme.icon, theme: theme.choice })
  }
  return items
}

// Your recent work, as items. Each list is loaded on its own, so one failing doesn't hide the rest.
async function recentItems() {
  const loads = await Promise.allSettled([
    listInterviews(),
    listBanks(),
    listCodingRounds(),
    listWhiteboards(),
    listDocuments(),
  ])
  const [interviews, banks, coding, whiteboards, documents] = loads.map((load) => (load.status === 'fulfilled' ? load.value : null))
  const items = []
  const add = (id, label, hint, icon, page) => items.push({ id, group: 'Recent', label, hint, icon, page })

  for (const interview of (interviews?.interviews || []).slice(0, RECENT_PER_KIND)) {
    add(`i-${interview.id}`, firstLine(interview.topic), 'Interview', 'target', `interview/${interview.id}`)
  }
  for (const bank of (banks?.banks || []).slice(0, RECENT_PER_KIND)) {
    add(`b-${bank.id}`, bank.title, 'Question bank', 'layers', `bank/${bank.id}`)
  }
  for (const round of (coding?.sessions || []).slice(0, RECENT_PER_KIND)) {
    add(`c-${round.id}`, round.title, 'Coding round', 'code', `coding/${round.id}`)
  }
  for (const board of (whiteboards?.sessions || []).slice(0, RECENT_PER_KIND)) {
    add(`w-${board.id}`, board.question, 'Whiteboard', 'pen', `whiteboard/${board.id}`)
  }
  for (const doc of (documents?.documents || []).slice(0, RECENT_PER_KIND)) {
    add(`d-${doc.id}`, doc.filename, 'Document', 'file', `docs/${doc.id}`)
  }
  return items
}

function firstLine(text) {
  const line = (text || '').split('\n')[0].trim()
  return line.length > 70 ? `${line.slice(0, 69)}…` : line
}

// Every word you typed must appear in the item's name or kind.
function matches(item, words) {
  const text = `${item.label} ${item.hint}`.toLowerCase()
  return words.every((word) => text.includes(word))
}

export default function CommandPalette() {
  const dialogRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState([])
  const [active, setActive] = useState(0) // the highlighted row

  // ⌘K / Ctrl+K anywhere, or the sidebar's button
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((wasOpen) => !wasOpen)
      }
    }
    function onButton() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-palette', onButton)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-palette', onButton)
    }
  }, [])

  // show or hide the <dialog>; load your recent work each time it opens
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      recentItems().then(setRecent)
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  let items = [...fixedItems(), ...recent]
  if (words.length) items = items.filter((item) => matches(item, words))
  else items = items.filter((item) => item.group !== 'Recent' || recent.indexOf(item) < 6) // a few recent ones
  items = items.slice(0, MAX_SHOWN)
  const highlighted = Math.min(active, Math.max(items.length - 1, 0))

  // keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector('.palette-item.on')?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  function close() {
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  function run(item) {
    close()
    if (item.theme) {
      setThemeChoice(item.theme, { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    } else {
      go(item.page)
    }
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((highlighted + 1) % Math.max(items.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((highlighted - 1 + items.length) % Math.max(items.length, 1))
    } else if (e.key === 'Enter' && items[highlighted]) {
      e.preventDefault()
      run(items[highlighted])
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="palette"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => e.target === dialogRef.current && close()}
      aria-label="Search or jump"
    >
      <div className="palette-box">
        <div className="palette-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={handleKey}
            placeholder="Search pages, actions, your interviews and banks…"
            aria-label="Search"
            autoFocus
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="palette-list" ref={listRef} role="listbox">
          {items.length === 0 && <p className="muted small palette-empty">Nothing matches “{query}”.</p>}
          {items.map((item, i) => (
            <div key={item.id}>
              {(i === 0 || items[i - 1].group !== item.group) && <div className="palette-group">{item.group}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === highlighted}
                className={`palette-item${i === highlighted ? ' on' : ''}`}
                onMouseMove={() => setActive(i)}
                onClick={() => run(item)}
              >
                <span className="palette-icon">
                  <Icon name={item.icon} size={15} />
                </span>
                <span className="palette-label">{item.label}</span>
                <span className="palette-hint">{item.hint}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> to move
          </span>
          <span>
            <span className="kbd">Enter</span> to open
          </span>
          <span>
            <span className="kbd">⌘</span> <span className="kbd">K</span> to toggle
          </span>
        </div>
      </div>
    </dialog>
  )
}
