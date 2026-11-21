import { BORED_LINE, MOODS } from '../lib/moods'
import { useIdle } from '../lib/useIdle'
import { useStats } from '../lib/useStats'
import Icon from './Icon'
import { SpiderArt } from './SpiderLoader'

const IDLE_MS = 3 * 60 * 1000 // 3 minutes without a click, a key or a scroll

// Your spider, at the bottom of the sidebar. Her colour is her health (see the Stats page):
// green = happy, yellow = okay, orange = itchy, red = angry. When you finish something today she climbs
// her thread to cheer. If you sit on a page doing nothing, she only looks bored: no pop-up, no sound.
// A click opens the Stats page.
export default function PetSpider({ current }) {
  const { stats, gained } = useStats()
  const idle = useIdle(IDLE_MS)
  if (!stats) return null // not loaded (or the backend is down): the sidebar looks as it did before

  const { mood, score } = stats.health
  const bored = idle && mood !== 'angry' // angry beats bored
  const days = stats.streak.current
  const face = bored ? 'bored' : mood === 'happy' ? undefined : mood

  return (
    <div className={`pet-wrap mood-${mood}`}>
      <a
        className={`pet${current === 'stats' ? ' on' : ''}${bored ? ' bored' : ''}`}
        href="#/stats"
        title={`${MOODS[mood].name} · health ${score}/100 · ${days}-day streak. Open your web`}
      >
        <svg className="pet-web" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M0 0L64 0M0 0L60 22M0 0L45 45M0 0L22 60M0 0L0 64" />
          <path d="M16 0L15 5.5L11.3 11.3L5.5 15L0 16M30 0L28.2 10.3L21.2 21.2L10.3 28.2L0 30M44 0L41.4 15L31.1 31.1L15 41.4L0 44" />
        </svg>

        {/* a new key each time you finish something replays her cheer */}
        <span key={gained} className={`pet-spider${gained ? ' cheer' : ''}`}>
          <SpiderArt mood={face} />
        </span>

        <span className="pet-info">
          <span className="pet-top">
            <span className="pet-mood side-label">{MOODS[mood].name}</span>
            <span className="pet-streak" aria-label={`${days}-day streak`}>
              <Icon name="flame" size={13} />
              {days}
            </span>
          </span>
          <span className="pet-line side-label">{bored ? BORED_LINE : MOODS[mood].line}</span>
        </span>
      </a>

      {gained > 0 && (
        <span key={gained} className="pet-bubble" role="status">
          Yay! {days}-day streak
        </span>
      )}
    </div>
  )
}
