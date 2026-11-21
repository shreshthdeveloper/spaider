import { useState } from 'react'
import Icon from '../Icon'
import { SpiderArt } from '../SpiderLoader'

// The web on the Stats page: your spider sits in the middle, and each task is a fly caught on a spoke.
// Click a fly to go and deal with it. Ignored tasks leave silk tangles and dust; a clean web gets dew drops.
// The drawing is an SVG of 600 x 600 centred on 0,0; the flies are links laid over it.

const SPOKES = 16
const RINGS = [44, 86, 128, 170, 212, 254]
const FLY_RING = 212 // flies sit where this ring meets every other spoke (8 places)
const PILES_UP = ['unfinished', 'weak'] // the same as services/stats/health.py

const FLY_ICONS = { today: 'flag', bank: 'layers', unfinished: 'clock', weak: 'target' }

function angleOf(spoke) {
  return ((-90 + (360 / SPOKES) * spoke) * Math.PI) / 180
}

function point(radius, angle) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

function xy([x, y]) {
  return `${x.toFixed(1)} ${y.toFixed(1)}`
}

// One ring of silk: from spoke to spoke, each thread sagging a little towards the middle.
function ringPath(radius) {
  let d = `M${xy(point(radius, angleOf(0)))}`
  for (let i = 1; i <= SPOKES; i++) {
    d += ` Q${xy(point(radius * 0.93, angleOf(i - 0.5)))} ${xy(point(radius, angleOf(i)))}`
  }
  return d
}

const SPOKE_ENDS = Array.from({ length: SPOKES }, (_, i) => point(300, angleOf(i)))

// Where fly number i sits: on the odd spokes, starting at the top right and going clockwise.
function flySpot(i) {
  return point(FLY_RING, angleOf(i * 2 + 1))
}

export default function SpiderWeb({ flies, mood }) {
  const [look, setLook] = useState(null) // the fly you point at: she looks at it

  const messy = flies.filter((fly) => PILES_UP.includes(fly.kind))
  const clean = messy.length === 0
  const lookAt = look === null ? [0, 0] : point(1.6, angleOf(look * 2 + 1))

  return (
    <div className={`web-box mood-${mood}`}>
      <svg className={`spider-web${clean ? ' clean' : ' dusty'}`} viewBox="-300 -300 600 600" aria-hidden="true">
        {/* the frame: anchor threads out to the edges */}
        {SPOKE_ENDS.map(([x, y], i) => (
          <line key={`s${i}`} className="web-spoke" x1="0" y1="0" x2={x} y2={y} />
        ))}
        {RINGS.map((radius) => (
          <path key={radius} className="web-ring" d={ringPath(radius)} />
        ))}

        {/* every task that piles up leaves a tangle of silk, a broken thread and some dust next to its fly */}
        {flies.map((fly, i) => {
          if (!PILES_UP.includes(fly.kind)) return null
          const [x, y] = point(FLY_RING + 34, angleOf(i * 2 + 1) + 0.16)
          const [bx, by] = point(RINGS[5], angleOf(i * 2 + 1) - 0.2)
          return (
            <g key={`mess-${fly.id}`} className="web-mess">
              <path transform={`translate(${xy([x, y])}) scale(1.6)`} d="M0 0c6 -9 15 3 7 8s-12 -5 -3 -10s11 7 3 11s-9 -8 -1 -9" />
              <path d={`M${xy([bx, by])} q7 18 -2 38`} />
              <circle cx={x - 16} cy={y + 14} r="2.6" />
              <circle cx={x + 20} cy={y - 8} r="2" />
              <circle cx={x + 6} cy={y + 24} r="1.6" />
              <circle cx={x - 6} cy={y - 16} r="1.4" />
            </g>
          )
        })}

        {/* a clean web catches the morning dew */}
        {clean &&
          [
            [2, 2],
            [5, 9],
            [3, 13],
            [4, 6],
          ].map(([ring, spoke]) => {
            const [x, y] = point(RINGS[ring], angleOf(spoke))
            return (
              <g key={`dew-${ring}-${spoke}`} className="web-dew">
                <circle cx={x} cy={y} r="4.5" />
                <circle cx={x - 1.4} cy={y - 1.6} r="1.3" className="web-dew-shine" />
              </g>
            )
          })}
      </svg>

      <div className="web-hub" style={{ '--look-x': `${lookAt[0]}px`, '--look-y': `${lookAt[1]}px` }}>
        <SpiderArt mood={mood === 'happy' ? undefined : mood} />
      </div>

      {flies.map((fly, i) => {
        const [x, y] = flySpot(i)
        return (
          <a
            key={fly.id}
            className={`fly fly-${fly.kind}${fly.done ? ' done' : ''}`}
            href={`#/${fly.link}`}
            style={{ left: `${50 + (x / 600) * 100}%`, top: `${50 + (y / 600) * 100}%` }}
            title={fly.detail}
            aria-label={`${fly.title}. ${fly.detail}`}
            onMouseEnter={() => setLook(i)}
            onMouseLeave={() => setLook(null)}
            onFocus={() => setLook(i)}
            onBlur={() => setLook(null)}
          >
            <span className="fly-bug">
              <Icon name={fly.done ? 'check' : FLY_ICONS[fly.kind] || 'target'} size={15} />
            </span>
            <span className="fly-label">{fly.title}</span>
          </a>
        )
      })}
    </div>
  )
}
