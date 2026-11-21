import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { askDocumentLive, getDocument, getDocumentMap } from '../../lib/api'
import { plural } from '../../lib/format'
import { Markdown } from '../../lib/markdown'
import { canDraw3D } from '../../lib/webgl'
import Composer from '../Composer'
import Icon from '../Icon'
import { SpiderArt } from '../SpiderLoader'
import SpiderLoader from '../SpiderLoader'
import RetrievalTrace from './RetrievalTrace'

// three.js is big, so the map is downloaded only when its tab is opened.
const VectorMap = lazy(() => import('./VectorMap'))

const SUGGESTIONS = [
  'Give me a short summary of this document',
  'What are the key points?',
  'What would an interviewer ask about this?',
  'Explain the hardest idea here in simple words',
]

let nextId = 1

// #/docs/<id>: ask questions about one PDF. Every answer comes only from that PDF and cites its pages.
// The "Under the hood" panel shows how the selected answer was found, and a 3D map of the chunks.
export default function DocumentChat({ id }) {
  const [doc, setDoc] = useState(null)
  const [missing, setMissing] = useState(false)
  const [exchanges, setExchanges] = useState([]) // { id, question, result | null, error, trace, written }
  const [asking, setAsking] = useState(false)
  const [selectedId, setSelectedId] = useState(null) // the answer shown in the panel; null = the latest
  const [tab, setTab] = useState('trace') // 'trace' | 'map'
  const [map, setMap] = useState(null) // loaded the first time the map tab opens
  const [mapError, setMapError] = useState('')
  const logRef = useRef(null)

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .catch((err) => err.status === 404 && setMissing(true))
  }, [id])

  // Keep the newest answer in view.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' })
  }, [exchanges])

  async function ask(question) {
    if (asking) return
    const exchangeId = nextId++
    setExchanges((prev) => [...prev, { id: exchangeId, question, result: null, error: '', trace: null, written: '' }])
    setSelectedId(null)
    setAsking(true)

    // Live messages: the search is done, then the answer arrives a few words at a time.
    function onEvent(name, data) {
      if (name === 'retrieved') updateExchange(exchangeId, (x) => ({ ...x, trace: data.trace }))
      if (name === 'token') updateExchange(exchangeId, (x) => ({ ...x, written: x.written + data.text }))
    }
    try {
      const result = await askDocumentLive(id, question, onEvent)
      updateExchange(exchangeId, (x) => ({ ...x, result }))
    } catch (err) {
      updateExchange(exchangeId, (x) => ({ ...x, error: err.message }))
    }
    setAsking(false)
  }

  // change(exchange) returns the new version of one exchange.
  function updateExchange(exchangeId, change) {
    setExchanges((prev) => prev.map((x) => (x.id === exchangeId ? change(x) : x)))
  }

  function openTab(name) {
    setTab(name)
    if (name === 'map' && !map) {
      getDocumentMap(id)
        .then(setMap)
        .catch((err) => setMapError(err.message))
    }
  }

  function showHow(exchangeId) {
    setSelectedId(exchangeId)
    setTab('trace')
  }

  if (missing) {
    return (
      <div className="card center-card">
        <h2>Document not found</h2>
        <p className="muted">It may have been deleted.</p>
        <a className="button-link primary" href="#/docs">
          Back to documents
        </a>
      </div>
    )
  }

  const selected = exchanges.find((x) => x.id === selectedId) || exchanges[exchanges.length - 1] || null

  return (
    <div className="doc-chat-layout">
      <section className="card chat-card doc-chat">
        <div className="chat-bar">
          <a className="back-link" href="#/docs" title="All documents">
            <Icon name="back" size={17} />
          </a>
          <span className="doc-thumb small">
            <Icon name="file" size={15} />
            <b>PDF</b>
          </span>
          <div className="chat-bar-text">
            <div className="chat-bar-title" title={doc?.filename}>
              {doc ? doc.filename : 'Loading…'}
            </div>
            {doc && (
              <div className="doc-facts">
                <span>{plural(doc.pages, 'page')}</span>
                <span>{plural(doc.chunks, 'chunk')}</span>
                <span className="grounded">
                  <Icon name="check" size={12} />
                  Answers only from this PDF
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="chat-log" ref={logRef}>
          {exchanges.length === 0 && (
            <div className="chat-welcome">
              <div className="welcome-icon">
                <Icon name="file" size={24} />
              </div>
              <h2>Ask anything about this document</h2>
              <p className="muted">
                Each answer cites the pages it comes from. If the PDF doesn't cover your question, you'll be told so.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((text) => (
                  <button key={text} className="suggestion" onClick={() => ask(text)} disabled={!doc || asking}>
                    <span className="suggestion-icon">
                      <Icon name="search" size={15} />
                    </span>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {exchanges.map((x) => (
            <div key={x.id} className={`exchange${selected?.id === x.id ? ' selected' : ''}`}>
              <div className="msg user">
                <div className="msg-bubble">{x.question}</div>
              </div>
              <Answer exchange={x} onShowHow={() => showHow(x.id)} />
            </div>
          ))}
        </div>

        <Composer onSend={ask} disabled={asking || !doc} placeholder="Ask a question about this document…" />
      </section>

      <aside className="card hood-card">
        <div className="hood-head">
          <div className="hood-title">
            <Icon name="layers" size={16} />
            Under the hood
          </div>
          <div className="seg">
            <button className={tab === 'trace' ? 'on' : ''} onClick={() => openTab('trace')}>
              Retrieval
            </button>
            <button className={tab === 'map' ? 'on' : ''} onClick={() => openTab('map')}>
              Vector map
            </button>
          </div>
        </div>

        <div className="hood-body">
          {tab === 'trace' && <RetrievalTrace key={selected?.id} exchange={selected} chunkCount={doc?.chunks || 0} />}

          {tab === 'map' && (
            <>
              {mapError && <p className="muted">{mapError}</p>}
              {!mapError && !canDraw3D() && <p className="muted">This browser can't draw 3D.</p>}
              {!mapError && canDraw3D() && !map && (
                <SpiderLoader label="Loading the chunk vectors…" />
              )}
              {map && canDraw3D() && (
                <Suspense
                  fallback={
                    <SpiderLoader label="Drawing the map in 3D…" />
                  }
                >
                  <VectorMap map={map} trace={selected?.result?.trace || null} />
                </Suspense>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function Answer({ exchange, onShowHow }) {
  const { result, error, written } = exchange
  const trace = result?.trace

  return (
    <div className="msg ai">
      <div className="msg-avatar spider-face">
        <SpiderArt />
      </div>
      <div className="msg-body">
        <div className="msg-name">Document assistant</div>

        {!result && !error && !written && (
          <div className="msg-bubble searching">
            <span className="typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {exchange.trace ? 'Found the pages. Writing the answer…' : 'Searching the document…'}
          </div>
        )}

        {!result && !error && written && (
          <div className="msg-bubble writing">
            <Markdown text={written} />
          </div>
        )}

        {error && <div className="msg-bubble answer-error">{error}</div>}

        {result && (
          <>
            <div className={`msg-bubble${result.found ? '' : ' not-found'}`}>
              {!result.found && <Icon name="alert" size={16} />}
              <Markdown text={result.answer} />
            </div>
            {result.sources.length > 0 && (
              <div className="sources">
                {result.sources.map((s, i) => (
                  <details key={i} className="source">
                    <summary>
                      <span className="cite">p. {s.page}</span>
                      <span className="muted small">match {s.score}</span>
                      <Icon name="chevron" size={13} className="source-chevron" />
                    </summary>
                    <p className="source-text">{s.text}</p>
                  </details>
                ))}
              </div>
            )}
            {trace && (
              <button className="how-btn" onClick={onShowHow}>
                <Icon name="layers" size={13} />
                How this was found · {plural(trace.hits.length, 'chunk')} searched
                {trace.llm_called ? ` · AI ${(trace.generate_ms / 1000).toFixed(1)} s` : ' · AI not needed'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
