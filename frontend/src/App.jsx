import { useState } from 'react'
import CommandPalette from './components/CommandPalette'
import FocusLayer from './components/focus/FocusLayer'
import Sidebar from './components/Sidebar'
import SplashScreen from './components/SplashScreen'
import { useFocus } from './lib/focus'
import { useRoute } from './lib/router'
import ChatPage from './pages/ChatPage'
import CodingPage from './pages/CodingPage'
import DocumentsPage from './pages/DocumentsPage'
import EvalsPage from './pages/EvalsPage'
import InterviewPage from './pages/InterviewPage'
import QuestionBankPage from './pages/QuestionBankPage'
import PanelPage from './pages/PanelPage'
import ResumePage from './pages/ResumePage'
import StatsPage from './pages/StatsPage'
import TracesPage from './pages/TracesPage'
import WhiteboardPage from './pages/WhiteboardPage'

// Which component to show for each #/route. A new page = one new line here.
const PAGES = {
  chat: ChatPage,
  interview: InterviewPage,
  docs: DocumentsPage,
  traces: TracesPage,
  whiteboard: WhiteboardPage,
  coding: CodingPage,
  stats: StatsPage,
  bank: QuestionBankPage,
  resume: ResumePage,
  panel: PanelPage,
  evals: EvalsPage,
}

// Whether the sidebar was left collapsed, remembered in this browser (it works without it, too).
function wasCollapsed() {
  try {
    return localStorage.getItem('spaider-sidebar') === 'collapsed'
  } catch {
    return false
  }
}

export default function App() {
  const { page, arg } = useRoute()
  const Page = PAGES[page] || InterviewPage
  const [collapsed, setCollapsed] = useState(wasCollapsed)
  const focus = useFocus()

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem('spaider-sidebar', next ? 'collapsed' : 'open')
    } catch {
      // private mode or blocked storage: it just won't be remembered
    }
  }

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}${focus.on ? ' focusing' : ''}`}>
      <Sidebar current={page} collapsed={collapsed} onToggle={toggleSidebar} />
      <main className="content">
        {/* arg is the part after the page name, e.g. the id in #/chat/<id> or #/interview/<id>.
            The key makes React open a fresh page whenever the page or the id changes. */}
        <Page key={`${page}/${arg}`} arg={arg} />
      </main>
      <CommandPalette />
      <FocusLayer />
      <SplashScreen />
    </div>
  )
}
