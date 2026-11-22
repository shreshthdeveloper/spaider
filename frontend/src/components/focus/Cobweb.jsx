// The web your spider spins over the screen while you're away: the longer you were gone, the more web.
//   under 10 s: one corner · under 30 s: two corners · under a minute: all four · longer: a big web
//   in the middle too. Each web has more rings the longer you were away.
// Drawn in SVG; the threads "spin" in with a CSS animation (styles/focus.css).

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export default function Cobweb({ seconds }) {
  let corners = 1
  if (seconds >= 10) corners = 2
  if (seconds >= 30) corners = 4
  const rings = Math.min(7, 2 + Math.floor(seconds / 8))

  // a corner web: threads fan out from the corner (0, 0) over a quarter circle
  const corner = webPaths({ cx: 0, cy: 0, radius: 200, from: 0, to: 90, spokes: 6, rings, closed: false })

  return (
    <div className="cobweb" aria-hidden="true">
      {CORNERS.slice(0, corners).map((place) => (
        <svg key={place} className={`web-corner ${place}`} viewBox="0 0 200 200">
          <WebThreads paths={corner} />
        </svg>
      ))}
      {seconds >= 60 && (
        <svg className="web-center" viewBox="0 0 200 200">
          <WebThreads paths={webPaths({ cx: 100, cy: 100, radius: 98, from: 0, to: 360, spokes: 12, rings, closed: true })} />
        </svg>
      )}
    </div>
  )
}

// pathLength="1" lets the CSS draw each thread from 0 to 1, whatever its real length.
function WebThreads({ paths }) {
  return paths.map((d, i) => <path key={i} d={d} pathLength="1" style={{ '--i': i }} />)
}

// The threads of one web, as SVG path strings: `spokes` straight threads from the centre (cx, cy),
// spread between the angles `from` and `to` (degrees), then `rings` threads across them, each one
// sagging a little towards the centre, like a real cobweb. closed: the web goes all the way round.
function webPaths({ cx, cy, radius, from, to, spokes, rings, closed }) {
  const step = (to - from) / (closed ? spokes : spokes - 1)
  const angles = []
  for (let i = 0; i < spokes; i++) angles.push(from + step * i)

  const paths = []
  for (const angle of angles) {
    const [x, y] = point(cx, cy, radius, angle)
    paths.push(`M${cx} ${cy}L${x} ${y}`)
  }

  const gaps = closed ? spokes : spokes - 1 // the spaces between neighbouring spokes
  for (let ring = 1; ring <= rings; ring++) {
    let d = ''
    for (let i = 0; i < gaps; i++) {
      // each ring sits a little in or out at each gap, so the web looks hand-spun, not drawn with a compass
      const size = ((radius * ring) / (rings + 0.6)) * (1 + 0.05 * Math.sin(i * 7 + ring * 3))
      const [x1, y1] = point(cx, cy, size, angles[i])
      const [x2, y2] = point(cx, cy, size, angles[i] + step)
      const [sagX, sagY] = point(cx, cy, size * 0.82, angles[i] + step / 2)
      d += `M${x1} ${y1}Q${sagX} ${sagY} ${x2} ${y2}`
    }
    paths.push(d)
  }
  return paths
}

// The point `distance` away from (cx, cy) in the direction `degrees`, rounded to keep the SVG short.
function point(cx, cy, distance, degrees) {
  const radians = (degrees * Math.PI) / 180
  return [round(cx + distance * Math.cos(radians)), round(cy + distance * Math.sin(radians))]
}

function round(value) {
  return Math.round(value * 10) / 10
}
