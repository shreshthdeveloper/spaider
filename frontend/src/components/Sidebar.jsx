import { useEffect, useState } from 'react'
import { getHealth } from '../lib/api'
import { setThemeChoice, useTheme } from '../lib/theme'
import Icon from './Icon'
import PetSpider from './PetSpider'
import { SpiderArt } from './SpiderLoader'

// The left menu, in two groups. A new page = one new line here (and one in App.jsx).
// Practice chat is hidden from the menu (its page still opens at #/chat).
const NAV_GROUPS = [
  {
    title: 'Practice',
    items: [
      { id: 'interview', label: 'Mock interview', icon: 'target' },
      { id: 'panel', label: 'Panel interview', icon: 'users' },
      { id: 'whiteboard', label: 'Whiteboard', icon: 'pen' },
      { id: 'coding', label: 'Coding round', icon: 'code' },
      { id: 'resume', label: 'Resume grind', icon: 'idcard' },
      { id: 'bank', label: 'Question bank', icon: 'layers' },
      { id: 'docs', label: 'Documents', icon: 'file' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { id: 'stats', label: 'Stats', icon: 'web' },
      { id: 'evals', label: 'Evals', icon: 'chart' },
      { id: 'traces', label: 'AI traces', icon: 'bolt' },
    ],
  },
]

// Checks /api/health every 15 seconds, and also updates at once whenever
// any API call succeeds or fails (lib/api.js sends a "backend-status" event).
function useBackendStatus() {
  const [online, setOnline] = useState(null)
  const [mongo, setMongo] = useState(null) // "ok" | "down" | null (unknown)

  useEffect(() => {
    let alive = true
    const check = () =>
      getHealth()
        .then((data) => alive && setMongo(data.mongo ?? null))
        .catch(() => {})
    const onStatus = (e) => alive && setOnline(e.detail)

    window.addEventListener('backend-status', onStatus)
    check()
    const timer = setInterval(check, 15000)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('backend-status', onStatus)
    }
  }, [])

  return { online, mongo }
}

// The theme button flips what you see: light <-> dark. ("Follow my computer" is in the ⌘K palette.)
const THEME_LOOKS = {
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
}

function openPalette() {
  window.dispatchEvent(new Event('open-palette')) // CommandPalette listens for this
}

// collapsed: only icons are shown (the names appear when you point at them). onToggle switches it.
export default function Sidebar({ current, collapsed, onToggle }) {
  const { online, mongo } = useBackendStatus()
  const status = online === null ? 'idle' : online ? 'ok' : 'bad'
  const statusText = online === null ? 'Checking backend…' : online ? 'Backend online' : 'Backend offline'
  const { choice, theme } = useTheme()
  const themeLook = THEME_LOOKS[theme]
  const themeText = choice === 'system' ? `${themeLook.label} (auto)` : themeLook.label
  const otherTheme = theme === 'dark' ? 'light' : 'dark'

  function switchTheme(e) {
    const box = e.currentTarget.getBoundingClientRect()
    setThemeChoice(otherTheme, { x: box.left + box.width / 2, y: box.top + box.height / 2 }) // the colours spread from here
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <button
        className="side-toggle"
        onClick={onToggle}
        title={collapsed ? 'Open the sidebar' : 'Collapse the sidebar'}
        aria-label={collapsed ? 'Open the sidebar' : 'Collapse the sidebar'}
      >
        <Icon name="chevron" size={14} />
      </button>

      <a className="brand" href="#/interview" title="SpAIder">
        <span className="logo">
          <SpiderArt />
        </span>
        <span className="side-label">
          <span className="brand-name">
            Sp<span className="brand-ai">AI</span>der
          </span>
          <span className="brand-sub">Catches your weak spots before the interviewer does</span>
        </span>
      </a>

      <a className="button-link primary side-cta" href="#/interview" title={collapsed ? 'New interview' : undefined}>
        <Icon name="plus" size={16} />
        <span className="side-label">New interview</span>
      </a>

      <button className="side-search" onClick={openPalette} title={collapsed ? 'Search or jump (⌘K)' : undefined}>
        <Icon name="search" size={16} />
        <span className="side-label">Search or jump…</span>
        <span className="kbd side-label">⌘K</span>
      </button>

      <nav>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="side-title">{group.title}</div>
            {group.items.map((item) => (
              <a
                key={item.id}
                href={`#/${item.id}`}
                className={`nav-item${current === item.id ? ' on' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span className="side-label">{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <PetSpider current={current} />

      <div className="side-foot">
        <button
          className="theme-toggle"
          onClick={switchTheme}
          title={`Theme: ${themeText}. Click for ${THEME_LOOKS[otherTheme].label.toLowerCase()}`}
          aria-label={`Theme: ${themeText}. Switch to ${otherTheme}`}
        >
          <Icon name={themeLook.icon} size={15} />
          <span className="side-label">Theme: {themeText}</span>
        </button>
        <div className="status-line" title={statusText}>
          <span className={`dot ${status}`} />
          <span className="side-label">{statusText}</span>
        </div>
        {online && mongo && (
          <div className="status-line" title={mongo === 'ok' ? 'MongoDB connected' : 'MongoDB unreachable'}>
            <span className={`dot ${mongo === 'ok' ? 'ok' : 'bad'}`} />
            <span className="side-label">{mongo === 'ok' ? 'MongoDB connected' : 'MongoDB unreachable'}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
