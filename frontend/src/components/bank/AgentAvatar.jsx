import { lookOf } from '../../lib/agents'
import Icon from '../Icon'
import { SpiderArt } from '../SpiderLoader'

// A panel member's face: the SpAIder spider in the agent's colour. busy = legs moving (it is thinking).
// The judge is an old, serious spider with glasses. You (the human in the loop) are a person.
export default function AgentAvatar({ id, busy = false, size = 'medium' }) {
  if (id === 'you') {
    return (
      <span className={`agent-avatar human ${size}`} aria-hidden="true">
        <Icon name="user" size={size === 'small' ? 15 : 21} />
      </span>
    )
  }
  return (
    <span
      className={`agent-avatar ${size}${busy ? ' spider-alive' : ''}`}
      style={{ '--spider-color': lookOf(id).color }}
      aria-hidden="true"
    >
      <SpiderArt mood={id === 'judge' ? 'okay' : undefined} elder={id === 'judge'} />
    </span>
  )
}
