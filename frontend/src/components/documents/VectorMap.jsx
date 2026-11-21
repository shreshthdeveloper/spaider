import { useEffect, useRef, useState } from 'react'
import { createVectorScene, GROUP_COLORS } from '../../lib/vectorScene'

// Where a question lands on the map: the same recipe the backend used for the chunks
// (see services/rag/vector_map.py): (vector - mean) · axis / scale, for each of the 3 axes.
function placeOnMap(vector, map) {
  return map.axes.map((axis) => {
    let sum = 0
    for (let i = 0; i < vector.length; i++) sum += (vector[i] - map.mean[i]) * axis[i]
    return Math.max(-1.4, Math.min(1.4, sum / map.scale)) // keep it in view
  })
}

// Cosine similarity of two vectors: 1 = same direction (same meaning), 0 = unrelated.
function cosine(a, b) {
  let dot = 0
  let lengthA = 0
  let lengthB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    lengthA += a[i] * a[i]
    lengthB += b[i] * b[i]
  }
  return lengthA && lengthB ? dot / Math.sqrt(lengthA * lengthB) : 0
}

function groupColor(group) {
  return GROUP_COLORS[group.id % GROUP_COLORS.length]
}

// The 3D map of a document's chunks, grouped by meaning, with the selected question on it.
// This file (and three.js) is downloaded only when the "Vector map" tab is opened.
//   map    from GET /documents/<id>/map
//   trace  the selected answer's trace, or null
export default function VectorMap({ map, trace }) {
  const boxRef = useRef(null)
  const sceneRef = useRef(null)
  const [hover, setHover] = useState(null) // the ball under the mouse
  const [focus, setFocus] = useState(null) // the group highlighted from the lists below the map

  const sameSpace = Boolean(trace) && trace.query_vector.length === map.dimensions

  useEffect(() => {
    const scene = createVectorScene(boxRef.current, setHover)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setData({
      points: map.points,
      groups: map.groups,
      question: sameSpace ? placeOnMap(trace.query_vector, map) : null,
      hits: trace ? trace.hits : [],
      minRelevance: trace ? trace.min_relevance : 1,
    })
  }, [map, trace, sameSpace])

  useEffect(() => {
    sceneRef.current?.highlight(focus)
  }, [focus])

  // For each group: how close the question is to the group's centre (all the numbers, not the 3D picture),
  // and how many of the chunks the search found are in that group. Closest group first.
  let closeness = []
  if (sameSpace && map.groups.length > 1) {
    const groupOf = new Map(map.points.map((point) => [point.id, point.group]))
    closeness = map.groups
      .map((group) => ({
        ...group,
        similarity: cosine(trace.query_vector, group.centroid),
        found: trace.hits.filter((hit) => groupOf.get(hit.id) === group.id).length,
      }))
      .sort((a, b) => b.similarity - a.similarity)
  }
  const closest = closeness[0]

  return (
    <div className="vector-map">
      <div className="map-canvas" ref={boxRef}>
        {hover && (
          <div className={`map-tip${hover.onRight ? ' left' : ''}`} style={{ left: hover.x, top: hover.y }}>
            <b>
              Page {hover.page}
              {hover.score !== undefined && ` · score ${hover.score}`}
            </b>
            {map.groups.length > 1 && <span className="map-tip-group">Group: {hover.groupLabel}</span>}
            <span>{hover.text.slice(0, 140)}…</span>
          </div>
        )}
      </div>

      {map.groups.length > 1 && (
        <div className="group-list" onMouseLeave={() => setFocus(null)}>
          {map.groups.map((group) => (
            <button
              key={group.id}
              className={`group-chip${focus === group.id ? ' on' : ''}`}
              onMouseEnter={() => setFocus(group.id)}
              onFocus={() => setFocus(group.id)}
              onBlur={() => setFocus(null)}
              title="Highlight this group"
            >
              <i style={{ background: groupColor(group) }} />
              {group.label}
              <span className="muted">{group.size}</span>
            </button>
          ))}
        </div>
      )}

      <div className="map-keys muted small">
        <span>
          <i className="diamond" /> your question
        </span>
        <span>
          <i className="ring" /> found by the search
        </span>
        <span>
          <i className="line solid" /> sent to the AI
        </span>
        <span>
          <i className="line faint" /> below the cutoff
        </span>
      </div>

      {closest && (
        <div className="why-box" onMouseLeave={() => setFocus(null)}>
          <div className="why-title">Why these chunks?</div>
          <p className="small">
            Your question is closest to the group <b>{closest.label}</b>, and {closest.found} of the {trace.hits.length}{' '}
            chunks the search found are in it.
          </p>
          {closeness.map((group) => (
            <div key={group.id} className="why-row" onMouseEnter={() => setFocus(group.id)}>
              <i style={{ background: groupColor(group) }} />
              <span className="why-label">{group.label}</span>
              <span className="why-track">
                <span style={{ width: `${Math.max(2, group.similarity * 100)}%`, background: groupColor(group) }} />
              </span>
              <span className="why-value">{group.similarity.toFixed(2)}</span>
              <span className="why-found">{group.found} found</span>
            </div>
          ))}
          <p className="muted small why-note">How similar the question is to the centre of each group, using all the numbers.</p>
        </div>
      )}

      <p className="muted small map-note">
        {map.groups.length > 1 &&
          `Chunks are grouped by meaning using all ${map.dimensions.toLocaleString()} numbers, so the groups are real. `}
        To draw them, PCA squeezes the numbers to 3, so positions are only a picture: the scores in the Retrieval tab are
        the exact ones. Drag to turn, scroll to zoom.
      </p>
    </div>
  )
}
