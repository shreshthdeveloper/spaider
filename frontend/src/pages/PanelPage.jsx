import PanelSession from '../components/panel/PanelSession'
import PanelSetup from '../components/panel/PanelSetup'
import PastPanels from '../components/panel/PastPanels'

// #/panel        -> tab 1: the role, what the panel reads, and who sits on it
// #/panel/past   -> tab 2: every panel interview so far
// #/panel/<id>   -> that panel interview: the room while it runs, then the decision
export default function PanelPage({ arg }) {
  if (arg === 'past') return <PastPanels />
  if (arg) return <PanelSession key={arg} id={arg} />
  return <PanelSetup />
}
