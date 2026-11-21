"""Run the evals from the terminal (inside backend/, with the virtual environment on):

    python -m evals.run grader     # the interview grader (20 AI calls)
    python -m evals.run judge      # the question bank judge (1 AI call)
    python -m evals.run            # both

It prints every case and the scores, and saves the run, so it also shows on the Evals page."""
import sys

from dotenv import load_dotenv

load_dotenv()  # the OpenAI key and MONGO_* settings, like app.py

from db import init_db  # noqa: E402  (after load_dotenv, so the settings are there)
from evals.suites import SUITES  # noqa: E402
from services import eval_service  # noqa: E402


def main():
    """Runs the suites named on the command line (all of them if none), and prints every case and the scores.
    Runs the suites named on the command line (all of them if none), and prints every case and the scores."""
    names = sys.argv[1:] or list(SUITES)
    for name in names:
        if name not in SUITES:
            print(f"Unknown suite '{name}'. Choose from: {', '.join(SUITES)}")
            return
    init_db()
    for name in names:
        print(f"\n=== {SUITES[name]['name']} ===")
        run = eval_service.run_now(name)
        if run.status == "failed":
            print("FAILED:", run.error)
            continue
        for case in run.cases:
            print_case(name, case)
        print_scores(run)


def print_case(suite, case):
    """One line per case: PASS or FAIL, then what you expected next to what the AI did."""
    mark = "PASS" if case["passed"] else "FAIL"
    if case["error"]:
        print(f"  ERROR {case['id']}: {case['error']}")
    elif suite == "grader":
        expected = _marks(case["expected"])
        got = _marks(case["got"])
        print(f"  {mark}  {case['id']:<24} you {expected:<5} grader {got:<5} "
              f"score you {case['expected_score']} / grader {case['got_score']}")
    else:
        expected = "drop" if case["expected_drop"] else "keep"
        got = "drop" if case["got_drop"] else "keep"
        print(f"  {mark}  {case['id']:<14} {case['kind']:<13} expected {expected:<5} judge {got:<5} {case['reason'][:60]}")


def print_scores(run):
    """The run's scores, as percentages (the score gap in points)."""
    print(f"\n  model {run.model}, prompt {run.prompt_version}, {run.duration_ms / 1000:.1f} s")
    for name, value in run.metrics.items():
        if name == "summary":
            continue
        if name == "score_gap":
            print(f"  {name:<16} {value} points")
        elif isinstance(value, float):
            print(f"  {name:<16} {value:.0%}")
        else:
            print(f"  {name:<16} {value}")


def _marks(points):
    """[True, False, True] -> "Y-Y" (Y = covered)."""
    marks = ""
    for point in points:
        if point:
            marks += "Y"
        else:
            marks += "-"
    return marks


if __name__ == "__main__":
    main()
