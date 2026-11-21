// Runs Python in the browser with Pyodide (Python compiled to WebAssembly), inside a Web Worker
// (a module worker: Pyodide's module build needs one). So your code never runs on our server, and an
// endless loop can't freeze the page: lib/python.js simply stops this worker and starts a new one.
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/'

// The test runner, in Python. load_code() runs your code once; run_test() calls your function for one test.
const RUNNER = `
import contextlib, copy, io, json, time

_space = {}

def load_code(code):
    global _space
    _space = {}
    try:
        exec(compile(code, "solution.py", "exec"), _space)
        return ""
    except SyntaxError as error:
        return f"SyntaxError on line {error.lineno}: {error.msg}"
    except Exception as error:
        return f"{type(error).__name__}: {error}"

def _plain(value):
    # tuples and sets become lists, so (1, 2) matches [1, 2]
    return json.loads(json.dumps(value, default=list))

def _same(got, expected, compare):
    if compare == "any_order" and isinstance(got, list) and isinstance(expected, list):
        try:
            return sorted(got) == sorted(expected)
        except TypeError:
            return False
    return got == expected

def _short(value):
    text = json.dumps(value)
    return text if len(text) <= 200 else text[:200] + "..."

def run_test(test_json, function, compare):
    test = json.loads(test_json)
    result = {"expected": _short(test["expected"])}
    solution = _space.get(function)
    if not callable(solution):
        result.update(ok=False, error=f"There is no function called {function}")
        return json.dumps(result)

    # big inputs are built here, before the clock starts
    args = eval(test["args_code"]) if "args_code" in test else copy.deepcopy(test["args"])
    printed = io.StringIO()
    start = time.perf_counter()
    try:
        with contextlib.redirect_stdout(printed):
            got = solution(*args)
        result["ms"] = round((time.perf_counter() - start) * 1000, 1)
        try:
            got = _plain(got)
            result["got"] = _short(got)
        except (TypeError, ValueError):  # not a list, number, text... (e.g. an object): show what it is
            got = repr(got)
            result["got"] = got[:200]
        result["ok"] = _same(got, test["expected"], compare)
        if result["ok"] and test.get("limit_ms") and result["ms"] > test["limit_ms"]:
            result.update(ok=False, slow=True)
    except Exception as error:
        result["ms"] = round((time.perf_counter() - start) * 1000, 1)
        result.update(ok=False, error=f"{type(error).__name__}: {error}")
    result["printed"] = printed.getvalue()[-2000:]
    return json.dumps(result)
`

const ready = import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`)
  .then(({ loadPyodide }) => loadPyodide({ indexURL: PYODIDE }))
  .then((pyodide) => {
    pyodide.runPython(RUNNER)
    return pyodide
  })

ready.then(
  () => self.postMessage({ type: 'ready' }),
  (error) => self.postMessage({ type: 'failed', error: String(error) }),
)

// One job = your code + the tests to run. Each result is sent back as soon as that test is done.
self.onmessage = async ({ data }) => {
  const pyodide = await ready
  const loadError = pyodide.globals.get('load_code')(data.code)
  if (loadError) {
    self.postMessage({ type: 'done', error: loadError })
    return
  }
  const runTest = pyodide.globals.get('run_test')
  for (let i = 0; i < data.tests.length; i++) {
    const result = JSON.parse(runTest(JSON.stringify(data.tests[i]), data.function, data.compare))
    self.postMessage({ type: 'result', index: i, result })
  }
  self.postMessage({ type: 'done', error: '' })
}
