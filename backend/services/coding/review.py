"""Bella reads the code and reacts: what to say out loud, and up to 2 notes pinned to lines."""
from langchain_core.messages import HumanMessage, SystemMessage

from services.coding.prompts import review_prompt
from services.coding.schemas import CodeReview
from services.llm import get_model
from services.text import conversation_text

MAX_NOTES = 2


def review_code(session, problem, code, results, reply="", wants_hint=False):
    """Returns {"say": "...", "notes": [{"line": 3, "text": "..."}]}."""
    text = (
        f"Problem: {problem['title']}\n{problem['statement']}\n\n"
        f"The candidate's code (line numbers on the left):\n{numbered(code)}\n\n"
        f"Latest test results: {test_summary(results)}\n\n"
        f"Conversation so far:\n{conversation_text(session.messages)}"
    )
    if reply:
        text += f"\n\nThe candidate just said: {reply}"
    if wants_hint:
        text += "\n\nThe candidate asked for a hint."

    reviewer = get_model().with_structured_output(CodeReview)
    review = reviewer.invoke(
        [SystemMessage(review_prompt(session.mode)), HumanMessage(text)],
        config={"metadata": {"step": "coding_review", "thread_id": str(session.id)}},
    )

    # Keep only notes that point at a real line of the code.
    line_count = len(code.splitlines())
    notes = []
    for note in review.notes[:MAX_NOTES]:
        if 1 <= note.line <= line_count and note.text.strip():
            notes.append({"line": note.line, "text": note.text.strip()[:90]})

    return {"say": review.say.strip(), "notes": notes}


def numbered(code):
    """The code with a line number in front of every line, so the AI can point at lines."""
    lines = code.splitlines()
    if not lines:
        return "(no code yet)"
    numbered_lines = []
    for number, line in enumerate(lines, start=1):
        numbered_lines.append(f"{number:>3} | {line}")  # e.g. "  3 | return seen"
    return "\n".join(numbered_lines)


def test_summary(results):
    """e.g. '3 of 5 passed. Failed: "empty string": expected 0, got None'"""
    if not results:
        return "not run yet"
    failed = []
    for result in results:
        if not result.get("ok"):
            failed.append(result)
    passed = len(results) - len(failed)

    summary = f"{passed} of {len(results)} passed."
    for result in failed[:3]:  # the first 3 failures are enough for the AI
        if result.get("timed_out"):
            why = "did not finish in time (too slow, or an endless loop)"
        elif result.get("slow"):
            why = "right answer but too slow"
        elif result.get("error"):
            why = result["error"]
        else:
            why = f"expected {result.get('expected', '?')}, got {result.get('got', '?')}"
        summary += f' Failed "{result.get("name", "?")}": {why}.'
    return summary
