import { useEffect, useRef, useState } from 'react'
import { plural } from '../../lib/format'
import Icon from '../Icon'

function seconds(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

// How one answer was found, step by step, from the trace the backend sends with it
// (see services/rag/answer.py). Nothing here is guessed: every number comes from that request.
//   exchange    { question, result, error, trace }, the answer selected in the chat
//               (trace: the search part, which arrives live before the answer is written)
//   chunkCount  how many chunks the whole document has
export default function RetrievalTrace({ exchange, chunkCount }) {
  const [openChunk, setOpenChunk] = useState(null) // the hit whose text is shown

  if (!exchange) {
    return (
      <div className="hood-empty">
        <Icon name="search" size={22} />
        <p>Ask a question to see each step: the question becomes a vector, the closest chunks are found, and only those go to the AI.</p>
      </div>
    )
  }

  const trace = exchange.result?.trace || exchange.trace // steps 1 and 2: known as soon as the search is done
  const answered = exchange.result?.trace // steps 3 and 4: known once the answer is finished
  const pending = !exchange.result && !exchange.error
  if (exchange.error || (!pending && !trace)) {
    return <p className="muted">No trace for this answer.</p>
  }

  // While the answer is on its way, a step is "working".
  const state = (doneWhen) => (pending ? 'working' : doneWhen ? 'done' : 'skipped')
  const searchState = trace ? 'done' : 'working'
  const kept = trace ? trace.hits.filter((hit) => hit.score >= trace.min_relevance) : []
  const usedPages = exchange.result ? exchange.result.sources.map((s) => s.page) : []

  return (
    <div className="hood-trace">
      <p className="hood-question">“{exchange.question}”</p>

      <ol className="pipe">
        <li className={`pipe-step ${searchState}`} style={{ '--i': 0 }}>
          <span className="pipe-icon">
            <Icon name="sparkle" size={15} />
          </span>
          <div className="pipe-body">
            <div className="pipe-title">
              Embed the question
              {trace && <span className="pipe-time">{seconds(trace.embed_ms)}</span>}
            </div>
            {trace ? (
              <>
                <div className="muted small">
                  It becomes {trace.query_vector.length.toLocaleString()} numbers that capture its meaning.
                </div>
                <VectorStrip values={trace.query_vector} />
                <code className="vector-text">
                  [{trace.query_vector.slice(0, 4).map((v) => v.toFixed(4)).join(', ')}, …]
                </code>
              </>
            ) : (
              <div className="muted small">Turning the question into numbers…</div>
            )}
          </div>
        </li>

        <li className={`pipe-step ${searchState}`} style={{ '--i': 1 }}>
          <span className="pipe-icon">
            <Icon name="search" size={15} />
          </span>
          <div className="pipe-body">
            <div className="pipe-title">
              Search this PDF
              {trace && <span className="pipe-time">{seconds(trace.search_ms)}</span>}
            </div>
            {trace ? (
              <>
                <div className="muted small">
                  Compared with all {plural(chunkCount, 'chunk')} by cosine similarity (1 = same meaning). The top{' '}
                  {trace.top_k}, and the cutoff {trace.min_relevance.toFixed(2)}:
                </div>
                <ScoreBars
                  hits={trace.hits}
                  cutoff={trace.min_relevance}
                  usedPages={usedPages}
                  openChunk={openChunk}
                  onOpen={setOpenChunk}
                />
              </>
            ) : (
              <div className="muted small">Finding the closest chunks…</div>
            )}
          </div>
        </li>

        <li className={`pipe-step ${state(answered?.llm_called)}`} style={{ '--i': 2 }}>
          <span className="pipe-icon">
            <Icon name="chat" size={15} />
          </span>
          <div className="pipe-body">
            <div className="pipe-title">
              Ask the AI
              {answered?.llm_called && <span className="pipe-time">{seconds(answered.generate_ms)}</span>}
            </div>
            <div className="muted small">
              {pending && 'Writing the answer from the chunks only…'}
              {answered?.llm_called && `Sent ${plural(kept.length, 'chunk')}, with the rule: answer only from these, cite every page.`}
              {answered && !answered.llm_called &&
                `Skipped. No chunk scored ${answered.min_relevance.toFixed(2)} or more, so the AI was not called and could not make anything up.`}
            </div>
          </div>
        </li>

        <li className={`pipe-step ${state(answered?.llm_called)}`} style={{ '--i': 3 }}>
          <span className="pipe-icon">
            <Icon name="check" size={15} />
          </span>
          <div className="pipe-body">
            <div className="pipe-title">Check the citations</div>
            {pending && <div className="muted small">Waiting for the answer…</div>}
            {answered && !answered.llm_called && <div className="muted small">Nothing to check: the answer is “not found”.</div>}
            {answered?.llm_called && (
              <>
                <div className="muted small">Every page the AI cites must be a page it was given.</div>
                <div className="cited-pages">
                  {answered.cited_pages.length === 0 && <span className="muted small">The AI cited no pages.</span>}
                  {answered.cited_pages.map((page) => {
                    const ok = usedPages.includes(page)
                    return (
                      <span key={page} className={`cited ${ok ? 'ok' : 'dropped'}`}>
                        <Icon name={ok ? 'check' : 'x'} size={12} />
                        p. {page}
                        {!ok && ' · not in the sources, removed'}
                      </span>
                    )
                  })}
                </div>
                <div className={`hood-verdict ${exchange.result.found ? 'found' : 'missing'}`}>
                  {exchange.result.found
                    ? `Answer shown, citing ${usedPages.map((p) => `p. ${p}`).join(', ')}`
                    : 'No supported pages, so the answer is shown as not found'}
                </div>
              </>
            )}
          </div>
        </li>
      </ol>
    </div>
  )
}

// The question's vector as a strip of colours: teal for positive numbers, terracotta for negative,
// pale for numbers near zero. It shows that an embedding is just a long list of numbers.
function VectorStrip({ values }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const largest = Math.max(...values.map(Math.abs)) || 1
    const image = context.createImageData(values.length, 1)
    values.forEach((value, i) => {
      const strength = Math.min(1, Math.abs(value) / largest) ** 0.6
      const [r, g, b] = value >= 0 ? [47, 111, 98] : [194, 90, 52]
      // mix from the pale page colour (241, 237, 229) towards the colour, by strength
      image.data[i * 4] = 241 + (r - 241) * strength
      image.data[i * 4 + 1] = 237 + (g - 237) * strength
      image.data[i * 4 + 2] = 229 + (b - 229) * strength
      image.data[i * 4 + 3] = 255
    })
    context.putImageData(image, 0, 0)
  }, [values])

  return <canvas ref={canvasRef} className="vector-strip" width={values.length} height={1} aria-hidden="true" />
}

// One row per chunk the search found: its page, a bar for its score, and whether it was used.
function ScoreBars({ hits, cutoff, usedPages, openChunk, onOpen }) {
  return (
    <div className="score-bars">
      {hits.map((hit) => {
        const kept = hit.score >= cutoff
        let label = 'below cutoff'
        if (kept) label = usedPages.includes(hit.page) ? 'used' : 'sent'
        const open = openChunk === hit.id
        return (
          <div key={hit.id} className={`score-row${kept ? ' kept' : ''}`}>
            <button className="score-line" onClick={() => onOpen(open ? null : hit.id)} title="Show this chunk">
              <span className="score-page">p. {hit.page}</span>
              <span className="score-track">
                <span className="score-fill" style={{ width: `${Math.max(1, hit.score * 100)}%` }} />
                <span className="score-cutoff" style={{ left: `${cutoff * 100}%` }} />
              </span>
              <span className="score-value">{hit.score.toFixed(2)}</span>
              <span className={`score-label ${label.replace(' ', '-')}`}>{label}</span>
            </button>
            {open && <p className="score-text">{hit.text}</p>}
          </div>
        )
      })}
    </div>
  )
}
