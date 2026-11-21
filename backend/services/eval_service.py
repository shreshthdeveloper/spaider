"""What the evals route (and `python -m evals.run`) call: run a suite, save the result, list the runs."""
import logging
import threading
import time

from evals.suites import SUITES, describe, model_name, prompt_version
from models.eval_run import EvalRun

log = logging.getLogger(__name__)


def list_suites():
    """What each suite tests (see evals/suites.py)."""
    return describe()


def start_run(suite_id):
    """From the Evals page: saves a "running" run and does the work on its own thread (a second line of
    work inside the server), so the page gets an answer at once and checks back for the result."""
    run = _new_run(suite_id)
    threading.Thread(target=_work, args=(run,), daemon=True).start()
    return summary(run)


def run_now(suite_id):
    """From the terminal: runs the suite and waits for the result."""
    run = _new_run(suite_id)
    _work(run)
    return run


def _new_run(suite_id):
    """Saves a new "running" run, with the model and the prompt version being tested."""
    run = EvalRun(suite=suite_id, model=model_name(), prompt_version=prompt_version(suite_id))
    run.save()
    return run


def _work(run):
    """Runs the suite, then saves its scores and cases (or the error) and how long it took."""
    started = time.perf_counter()
    try:
        result = SUITES[run.suite]["run"]()
        run.metrics = result["metrics"]
        run.cases = result["cases"]
        run.status = "done"
    except Exception as error:
        log.exception("Eval %s failed", run.suite)
        run.status = "failed"
        run.error = f"{type(error).__name__}: {error}"
    run.duration_ms = round((time.perf_counter() - started) * 1000)
    run.save()


def list_runs(limit=50):
    """The latest runs, newest first, without their cases (they can be long)."""
    runs = []
    for run in EvalRun.objects.order_by("-created_at").exclude("cases").limit(limit):
        runs.append(summary(run))
    return runs


def summary(run):
    """A run without its cases."""
    return {
        "id": str(run.id),
        "suite": run.suite,
        "status": run.status,
        "model": run.model,
        "prompt_version": run.prompt_version,
        "metrics": run.metrics,
        "error": run.error,
        "duration_ms": run.duration_ms,
        "created_at": run.created_at.isoformat(),
    }


def build_response(run):
    """A run with every case."""
    response = summary(run)
    response["cases"] = run.cases
    return response
