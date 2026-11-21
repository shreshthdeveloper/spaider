"""The final report of a coding round.

Correctness comes from the tests. The other areas are judged by the AI, and the code checks its
evidence before giving any points (services/rubric.py: "no proof, no points")."""
from langchain_core.messages import HumanMessage, SystemMessage

from services.coding.prompts import REPORT_PROMPT
from services.coding.review import numbered, test_summary
from services.coding.schemas import CodingGrade
from services.llm import get_model
from services.rubric import average_points, candidate_words, rubric_text, score_areas
from services.text import conversation_text

# What a good answer shows, area by area. Correctness is not here: the tests decide it.
RUBRIC = [
    ("Understanding", "restates the problem and asks about edge cases or input size"),
    ("Approach", "explains a plan before coding, and why it works"),
    ("Complexity", "states the time and space complexity, and it fits the code"),
    ("Edge cases", "handles empty input, duplicates, negatives or a single element"),
    ("Code quality", "clear names and a simple structure, no dead code"),
    ("Communication", "thinks out loud and answers the interviewer's questions"),
]

HINT_COST = 0.5  # each hint in interview mode costs this much...
MAX_HINT_COST = 1.5  # ...up to this much in total


def write_report(session, problem, code, results):
    """The report: each area's level and points, the overall score, the hint cost, and the AI's summary."""
    passed = _count_passed(results)
    total = len(results)
    grade = _ask_for_grade(session, problem, code, results)

    # 1. Correctness: measured by running the tests, not judged by the AI.
    areas = [_correctness(passed, total)]

    # 2. The other areas: the AI judges; an area only scores if its quote is really in YOUR code or
    #    in what YOU said.
    areas += score_areas(RUBRIC, grade.checks, code=code, words=candidate_words(session.messages))

    # 3. Hints: free in practice mode; in interview mode they cost points.
    hint_cost = _hint_cost(session)

    overall = average_points(areas) - hint_cost
    return {
        "overall": max(0, round(overall, 1)),
        "areas": areas,
        "tests": {"passed": passed, "total": total},
        "hints_used": session.hints_used,
        "hint_cost": hint_cost,
        "best": problem["best"],
        "summary": grade.summary,
        "strengths": grade.strengths[:3],
        "improve": grade.improve[:3],
    }


def _ask_for_grade(session, problem, code, results):
    """The AI's judgement of every rubric area (level, quote, comment), plus a summary."""
    text = (
        f"Problem: {problem['title']}\n{problem['statement']}\n\n"
        f"Rubric:\n{rubric_text(RUBRIC)}\n\n"
        f"Final code:\n{numbered(code)}\n\n"
        f"Test results: {test_summary(results)}\n\n"
        f"Conversation:\n{conversation_text(session.messages, last=40)}"
    )
    grader = get_model().with_structured_output(CodingGrade)
    return grader.invoke(
        [SystemMessage(REPORT_PROMPT), HumanMessage(text)],
        config={"metadata": {"step": "coding_report", "thread_id": str(session.id)}},
    )


def _correctness(passed, total):
    """The Correctness area, scored from the test results (no AI)."""
    points = 0
    if total:
        points = round(5 * passed / total)
    return {
        "area": "Correctness",
        "looks_for": "passes the visible and hidden tests, including the big input in time",
        "level": _test_level(passed, total),
        "points": points,
        "evidence": f"{passed} of {total} tests passed",
        "unproven_claim": "",
        "comment": "Measured by running the tests, including the hidden ones.",
    }


def _test_level(passed, total):
    """The level for a share of passed tests: all = strong, 80%+ = good, 40%+ = basic."""
    if total and passed == total:
        return "strong"
    if total and passed >= 0.8 * total:
        return "good"
    if total and passed >= 0.4 * total:
        return "basic"
    return "missing"


def _hint_cost(session):
    """Points taken off for hints. Practice mode is free."""
    if session.mode != "interview":
        return 0
    return min(MAX_HINT_COST, HINT_COST * session.hints_used)


def _count_passed(results):
    """How many tests passed."""
    passed = 0
    for result in results:
        if result.get("ok"):
            passed += 1
    return passed
