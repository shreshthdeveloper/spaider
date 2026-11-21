import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import SpiderLoader from '../components/SpiderLoader'
import { getTrace, listTraces } from '../lib/api'
import { formatDate } from '../lib/format'
import { go } from '../lib/router'

const PER_PAGE = 20

// Friendly names for the "label" the backend saves with every AI call.
const LABELS = {
  chat: 'Practice chat',
  plan_questions: 'Interview · plan questions',
  grade: 'Interview · grade answer',
  follow_up: 'Interview · write follow-up',
  write_report: 'Interview · write report',
  document_answer: 'Document · answer question',
  whiteboard_review: 'Whiteboard · review board',
  whiteboard_report: 'Whiteboard · write report',
  coding_review: 'Coding · review code',
  coding_report: 'Coding · write report',
  bank_coordinator: 'Question bank · panel lead',
  bank_agent_technical: 'Question bank · Technical agent',
  bank_agent_python: 'Question bank · Python basics agent',
  bank_agent_system_design: 'Question bank · System design agent',
  bank_agent_coding: 'Question bank · Coding agent',
  bank_agent_resume: 'Question bank · Resume grill agent',
  bank_agent_recruiter: 'Question bank · Recruiter agent',
  bank_judge: 'Question bank · judge',
  'voice: speak': 'Voice · speak question',
  'voice: transcribe': 'Voice · transcribe answer',
}

// Which part of the app made a call: its icon, and the page its thread_id opens (if any).
const AREAS = [
  { test: (label) => label === 'chat', icon: 'chat' },
  { test: (label) => ['plan_questions', 'grade', 'follow_up', 'write_report'].includes(label), icon: 'target', page: 'interview' },
  { test: (label) => label.startsWith('document'), icon: 'file' },
  { test: (label) => label.startsWith('voice'), icon: 'mic' },
  { test: (label) => label.startsWith('whiteboard'), icon: 'pen', page: 'whiteboard' },
  { test: (label) => label.startsWith('coding'), icon: 'code', page: 'coding' },
  { test: (label) => label.startsWith('bank'), icon: 'layers', page: 'bank' },
]

// What the "Open this ..." link in a call's pop-up calls each page.
const PAGE_NAMES = { coding: 'coding round', bank: 'question bank' }

function labelOf(label) {
  return LABELS[label] || label
}

function areaOf(label) {
  return AREAS.find((area) => area.test(label || '')) || { icon: 'bolt' }
}

function duration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

// #/traces        -> every AI call, a page at a time
// #/traces/<id>   -> the same, with that call opened in a pop-up
export default function TracesPage({ arg }) {
  const [data, setData] = useState(null) // { traces, total, page, pages, labels }; null = loading
  const [page, setPage] = useState(1)
  const [label, setLabel] = useState('') // show only this kind of call; '' = all
  const [refreshes, setRefreshes] = useState(0) // the Refresh button bumps this to load the page again
  const [openId, setOpenId] = useState(arg || null) // the call shown in the pop-up
  const [opened, setOpened] = useState(null) // { id, trace } once loaded; trace is null if not found

  useEffect(() => {
    listTraces({ page, perPage: PER_PAGE, label })
      .then(setData)
      .catch(() => setData({ traces: [], total: 0, page: 1, pages: 1, labels: [] }))
  }, [page, label, refreshes])

  useEffect(() => {
    if (!openId) return
    getTrace(openId)
      .then((trace) => setOpened({ id: openId, trace }))
      .catch(() => setOpened({ id: openId, trace: null }))
  }, [openId])

  function close() {
    setOpenId(null)
    if (arg) go('traces') // opened from a link: go back to the plain list
  }

  const loadingOne = Boolean(openId) && opened?.id !== openId
  const selected = opened?.id === openId ? opened.trace : null

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Debugging</div>
          <h1>AI traces</h1>
          <p className="muted">Every call to the AI: the exact prompt it received, its answer, tokens and time. Kept for 7 days.</p>
        </div>
        <button onClick={() => setRefreshes((n) => n + 1)}>
          <Icon name="repeat" size={16} />
          Refresh
        </button>
      </header>

      <section className="card trace-card">
        <div className="trace-toolbar">
          <label className="trace-filter">
            <Icon name="layers" size={15} />
            <select
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                setPage(1)
              }}
              aria-label="Show one kind of call"
            >
              <option value="">All steps</option>
              {[...(data?.labels || [])].sort((a, b) => labelOf(a).localeCompare(labelOf(b))).map((value) => (
                <option key={value} value={value}>
                  {labelOf(value)}
                </option>
              ))}
            </select>
          </label>
          {data && <span className="muted small">{data.total.toLocaleString()} calls</span>}
        </div>

        {data === null && <SpiderLoader label="Loading AI calls…" />}
        {data && data.total === 0 && (
          <p className="muted trace-empty">No AI calls yet. Use the chat, an interview, a document or a round, then come back.</p>
        )}

        {data && data.traces.length > 0 && (
          <div className="trace-table-wrap">
            <table className="trace-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Step</th>
                  <th>Model</th>
                  <th className="num">Tokens</th>
                  <th className="num">Time</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.traces.map((trace) => (
                  <tr key={trace.id} className={trace.error ? 'failed' : ''}>
                    <td className="trace-when">{formatDate(trace.created_at)}</td>
                    <td>
                      <span className="trace-step">
                        <span className="trace-step-icon">
                          <Icon name={areaOf(trace.label).icon} size={13} />
                        </span>
                        {labelOf(trace.label)}
                      </span>
                    </td>
                    <td>
                      <code className="trace-model">{trace.model || '–'}</code>
                    </td>
                    <td className="num">{trace.total_tokens?.toLocaleString() ?? '–'}</td>
                    <td className="num">{duration(trace.duration_ms)}</td>
                    <td>
                      {trace.error ? <span className="badge score-bad">Failed</span> : <span className="badge score-good">OK</span>}
                    </td>
                    <td className="trace-action">
                      <button className="small" onClick={() => setOpenId(trace.id)}>
                        <Icon name="eye" size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </section>

      <Modal
        open={Boolean(openId)}
        title={selected ? labelOf(selected.label) : 'AI call'}
        subtitle={selected ? formatDate(selected.created_at) : ''}
        onClose={close}
      >
        {loadingOne && <SpiderLoader label="Loading this call…" />}
        {!loadingOne && !selected && <p className="muted">This call was not found. Traces are kept for 7 days.</p>}
        {!loadingOne && selected && <TraceDetail trace={selected} />}
      </Modal>
    </div>
  )
}

// "Showing 21–40 of 312", then Previous, the page numbers and Next.
function Pager({ page, pages, total, onPage }) {
  const first = (page - 1) * PER_PAGE + 1
  const last = Math.min(page * PER_PAGE, total)

  // Page numbers to show: the first, the last, and the ones next to this page ('…' for the gaps).
  const numbers = []
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) numbers.push(n)
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…')
  }

  return (
    <div className="pager">
      <span className="muted small">
        Showing {first}–{last} of {total.toLocaleString()}
      </span>
      <div className="pager-buttons">
        <button className="small" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <Icon name="chevron" size={14} className="flip" />
          Previous
        </button>
        {numbers.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="pager-gap">
              …
            </span>
          ) : (
            <button key={n} className={`small pager-number${n === page ? ' on' : ''}`} onClick={() => onPage(n)}>
              {n}
            </button>
          ),
        )}
        <button className="small" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next
          <Icon name="chevron" size={14} />
        </button>
      </div>
    </div>
  )
}

// Everything about one call: the facts, the exact prompt, and the answer.
function TraceDetail({ trace }) {
  const tokens = trace.tokens || {}
  const reasoning = tokens.output_token_details?.reasoning
  const area = areaOf(trace.label)

  return (
    <div className="trace-detail">
      <div className="trace-facts">
        {trace.model && <span>{trace.model}</span>}
        <span>{duration(trace.duration_ms)}</span>
        {tokens.total_tokens != null && (
          <span>
            {tokens.input_tokens} in · {tokens.output_tokens} out
            {reasoning ? ` (${reasoning} thinking)` : ''}
          </span>
        )}
        {trace.thread_id && area.page && (
          <a href={`#/${area.page}/${trace.thread_id}`}>
            Open this {PAGE_NAMES[area.page] || area.page}
            <Icon name="chevron" size={13} />
          </a>
        )}
      </div>

      {trace.error && <div className="trace-error">{trace.error}</div>}

      <h3 className="section-title">Prompt the AI received</h3>
      {trace.prompt.map((message, i) => (
        <div key={i} className="trace-message">
          <div className={`trace-role ${message.role}`}>{message.role}</div>
          <pre className="trace-text">{message.content}</pre>
        </div>
      ))}

      {!trace.error && (
        <>
          <h3 className="section-title">What it answered</h3>
          <div className="trace-message">
            <div className="trace-role output">output</div>
            <pre className="trace-text">{trace.output || '(empty)'}</pre>
          </div>
        </>
      )}
    </div>
  )
}
