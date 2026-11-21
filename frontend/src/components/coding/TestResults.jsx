import Icon from '../Icon'

// What a failed test shows: why it failed.
function failureText(result) {
  if (result.timed_out) return 'Did not finish in time: too slow, or an endless loop.'
  if (result.slow) return `Right answer, but too slow (${result.ms} ms).`
  if (result.error) return result.error
  return `Expected ${result.expected}, got ${result.got}`
}

// The panel under the editor: the latest test run, one row per test.
//   run       { results, error } from lib/python.js, or null before the first run
//   status    '' | 'loading' (Python is loading) | 'running'
export default function TestResults({ run, status }) {
  const results = run?.results || []
  const passed = results.filter((result) => result.ok).length

  return (
    <section className="code-tests">
      <div className="code-tests-head">
        <b>Tests</b>
        {status === 'loading' && <span className="muted small">Loading Python (only the first time)…</span>}
        {status === 'running' && <span className="muted small">Running…</span>}
        {!status && results.length > 0 && (
          <span className={`code-tests-score ${passed === results.length ? 'all' : ''}`}>
            {passed} / {results.length} passed
          </span>
        )}
      </div>

      {!run && !status && (
        <p className="muted small code-tests-empty">Press Run to test your code. Hidden tests run when you submit.</p>
      )}

      <div className="code-tests-list">
        {results.map((result, i) => (
          <div key={i} className={`code-test ${result.pending ? 'pending' : result.ok ? 'ok' : 'failed'}`}>
            <span className="code-test-icon">
              {result.pending ? <span className="spinner small" /> : <Icon name={result.ok ? 'check' : 'x'} size={13} />}
            </span>
            <span className="code-test-name">
              {result.name}
              {result.hidden && <span className="code-hidden">hidden</span>}
            </span>
            {result.ms !== undefined && <span className="code-test-ms">{result.ms} ms</span>}
            {!result.pending && !result.ok && <div className="code-test-why">{failureText(result)}</div>}
            {result.printed && <pre className="code-test-printed">{result.printed}</pre>}
          </div>
        ))}
      </div>
    </section>
  )
}
