"""Eval 1: the interview grader. Does it agree with you about which key points an answer covers?

It runs the REAL grading step of the mock interview (services/interview/nodes.py, grade) on every
answer in cases/grader_cases.json, and compares its call on each key point with your label."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from evals.metrics import key_point_metrics, score_from_points, score_metrics
from services.interview.nodes import grade

CASES_FILE = Path(__file__).parent / "cases" / "grader_cases.json"
AT_ONCE = 5  # answers graded at the same time (each is one AI call)


def load_cases():
    """The answer key: every case in cases/grader_cases.json."""
    return json.loads(CASES_FILE.read_text())


def run():
    """Grades every case. Returns {"metrics": {...}, "cases": [one result per case]}."""
    cases = load_cases()
    # 20 AI calls one after another take about a minute; five at a time take about 15 seconds
    with ThreadPoolExecutor(max_workers=AT_ONCE) as pool:
        results = list(pool.map(grade_case, cases))

    graded = []
    for result in results:
        if not result["error"]:
            graded.append(result)
    metrics = key_point_metrics(graded)
    metrics.update(score_metrics(graded))
    metrics["cases"] = len(results)
    metrics["errors"] = len(results) - len(graded)
    return {"metrics": metrics, "cases": results}


def grade_case(case):
    """One answer through the real grader, side by side with your labels."""
    result = {
        "id": case["id"],
        "kind": case["kind"],
        "question": case["question"],
        "answer": case["answer"],
        "key_points": case["key_points"],
        "note": case.get("note", ""),
        "expected": case["expected"],
        "expected_score": score_from_points(case["expected"]),
        "got": [],
        "got_score": None,
        "feedback": "",
        "passed": False,
        "error": "",
    }
    # the same state the interview graph gives the grade step
    state = {
        "answer": case["answer"],
        "current_question": case["question"],
        "current_points": case["key_points"],
        "follow_ups": 0,
        "results": [],
    }
    try:
        graded = grade(state)["last_grade"]
    except Exception as error:
        result["error"] = f"{type(error).__name__}: {error}"
        return result

    got = []
    for point in case["key_points"]:
        got.append(point in graded["covered"])
    result["got"] = got
    result["got_score"] = graded["score"]
    result["feedback"] = graded["feedback"]
    result["passed"] = got == case["expected"]
    return result
