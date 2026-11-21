// Runs your Python code against a problem's tests, in a Web Worker with Pyodide (see pythonWorker.js).
// No React here.
//   warmUpPython()                          start loading Python early (about 12 MB the first time, then cached)
//   runTests(problem, code, options)        resolves with { results, error }
let worker = null
let ready = null // resolves when Python has loaded in the worker

function startWorker() {
  worker = new Worker(new URL('./pythonWorker.js', import.meta.url), { type: 'module' })
  ready = new Promise((resolve, reject) => {
    worker.addEventListener('message', function onReady(event) {
      if (event.data.type === 'ready') {
        worker.removeEventListener('message', onReady)
        resolve()
      }
      if (event.data.type === 'failed') reject(new Error(`Python could not load (${event.data.error})`))
    })
  })
}

export function warmUpPython() {
  if (!worker) startWorker()
  return ready
}

// Runs the tests one by one and returns one result per test:
//   { name, hidden, ok, expected, got, error, ms, slow, timed_out, printed }
// options.includeHidden  also run the hidden tests (when you submit)
// options.onProgress     called with the results so far, after each test
// If the tests take too long (too slow, or an endless loop), the worker is stopped,
// and the tests that did not finish are marked timed_out. The next run starts a fresh worker.
export async function runTests(problem, code, { includeHidden = false, onProgress = () => {} } = {}) {
  const tests = problem.tests.filter((test) => includeHidden || !test.hidden)
  await warmUpPython()

  const results = tests.map((test) => ({ name: test.name, hidden: Boolean(test.hidden), ok: false, pending: true }))
  const timeLimit = 4000 + tests.reduce((sum, test) => sum + (test.limit_ms || 0) * 2, 0)

  return new Promise((resolve) => {
    function finish(error) {
      clearTimeout(timer)
      worker?.removeEventListener('message', onMessage)
      resolve({ results: results.map(({ pending, ...result }) => (pending ? { ...result, timed_out: true } : result)), error })
    }

    const timer = setTimeout(() => {
      worker.terminate() // the only way to stop Python mid-loop
      worker = null
      finish('')
    }, timeLimit)

    function onMessage({ data }) {
      if (data.type === 'result') {
        results[data.index] = { ...results[data.index], ...data.result, pending: false }
        onProgress(results)
      }
      if (data.type === 'done') {
        if (data.error) {
          // the code itself does not run (e.g. a syntax error): every test fails with that error
          for (let i = 0; i < results.length; i++) results[i] = { ...results[i], ok: false, pending: false, error: data.error }
        }
        finish(data.error)
      }
    }

    worker.addEventListener('message', onMessage)
    worker.postMessage({ code, function: problem.function, compare: problem.compare, tests })
  })
}
