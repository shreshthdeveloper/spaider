"""The Interview X-ray: every step the interview graph took, in order, with what it decided and why.

LangGraph saves a checkpoint (the whole state) after every step. Read oldest first, each checkpoint says
which node runs next (`next`), and the checkpoint after it holds the state once that node has run.
So two checkpoints in a row are one step:

    checkpoint A: next = ("grade",)       checkpoint B: the state after grade ran
    ------------------------------------------------------------------------------
    step: "grade" ran, and B tells us its score, the points missed, and (via decide_next) where it went next
"""
from datetime import datetime

from services.interview.nodes import decide_next

# The graph's nodes, in the order the X-ray draws them (graph.py has the real wiring).
NODES = ["plan_questions", "ask", "grade", "follow_up", "next_question", "write_report"]


def timeline(graph, config, reveal):
    """{"steps": [...], "now": {...}, "taken": {"grade->follow_up": 2, ...}}

    reveal: show the key points of each question. Only once the interview is finished, so nobody can
    use the X-ray to see what a good answer must say while it is still running."""
    history = list(graph.get_state_history(config))  # newest first
    history.reverse()  # oldest first

    steps = []
    for before, after in zip(history, history[1:]):
        for node in before.next:
            if node.startswith("__"):
                continue  # "__start__" is LangGraph's own first step
            steps.append(_describe(node, before, after, reveal))

    now = _now(history)
    return {"steps": steps, "now": now, "taken": _paths_taken(steps, now)}


def _describe(node, before, after, reveal):
    """One step in plain words: a title, details, and (after a grade) where it went next and why."""
    values = after.values
    step = {
        "node": node,
        "at": after.created_at,
        "ms": _ms_between(before.created_at, after.created_at),
        "title": node,
        "details": [],
        "next": "",
        "reason": "",
    }

    if node == "plan_questions":
        _describe_plan(step, values, reveal)
    elif node == "ask":
        _describe_ask(step, values, reveal)
    elif node == "grade":
        _describe_grade(step, values, reveal)
    elif node == "follow_up":
        step["title"] = "Wrote a follow-up question"
        step["details"].append(f"Follow-up: {values['current_question']}")
        if reveal:
            step["details"].append(f"It aims at: {'; '.join(values['current_points'])}")
    elif node == "next_question":
        step["title"] = f"Moved on to question {values['index'] + 1}"
        step["details"].append(f"Question: {values['current_question']}")
    elif node == "write_report":
        report = values.get("report", {})
        step["title"] = f"Wrote the report: {report.get('overall', 0)}/5"
        if report.get("summary"):
            step["details"].append(report["summary"])
    return step


def _describe_plan(step, values, reveal):
    """plan_questions: how many questions, and (once finished) which."""
    questions = values.get("questions", [])
    step["title"] = f"Planned {len(questions)} questions"
    if not reveal:
        step["details"].append("The questions show here once the interview is finished.")
        return
    for number, planned in enumerate(questions, start=1):
        step["details"].append(f"Q{number}: {planned['question']}")


def _describe_ask(step, values, reveal):
    """ask: the question and your answer, or that you pressed End."""
    if values.get("ended"):
        step["title"] = "You ended the interview"
        return
    number = values["index"] + 1
    if values["follow_ups"] > 0:
        step["title"] = f"Asked a follow-up to question {number}, and got your answer"
    else:
        step["title"] = f"Asked question {number}, and got your answer"
    step["details"].append(f"Question: {values['current_question']}")
    step["details"].append(f"Your answer: {values.get('answer', '')}")
    if reveal:
        step["details"].append(f"Key points: {'; '.join(values['current_points'])}")


def _describe_grade(step, values, reveal):
    """grade: the score, the feedback, and where the graph went next and why (the same decide_next() as route())."""
    grade = values["last_grade"]
    covered = len(grade["covered"])
    total = covered + len(grade["missed"])
    step["title"] = f"Graded: {grade['score']}/5 ({covered} of {total} key points)"
    if reveal:
        step["details"].append(f"Covered: {', '.join(grade['covered']) or 'none'}")
        step["details"].append(f"Missed: {', '.join(grade['missed']) or 'none'}")
    step["details"].append(f"Feedback: {grade['feedback']}")
    step["next"], step["reason"] = decide_next(values)


def _now(history):
    """Where the interview is right now: waiting for your answer, finished, or between two steps."""
    if not history:
        return {"node": "", "label": "Not started"}
    latest = history[-1]
    if latest.interrupts:
        return {"node": "ask", "label": "Waiting for your answer"}
    if not latest.next:
        return {"node": "END", "label": "Finished"}
    # Between two steps: either the next one is running right now, or it failed (the page offers Try again).
    return {"node": latest.next[0], "label": f"Next step: {latest.next[0]}"}


def _paths_taken(steps, now):
    """How many times the graph went from one node to the next, e.g. {"grade->follow_up": 2}.
    The last path leads to where it is now (waiting at ask, or END), which has no step of its own yet."""
    taken = {}
    previous = "START"
    for step in steps:
        path = f"{previous}->{step['node']}"
        taken[path] = taken.get(path, 0) + 1
        previous = step["node"]
    if now["node"]:
        path = f"{previous}->{now['node']}"
        taken[path] = taken.get(path, 0) + 1
    return taken


def _ms_between(start, end):
    """Milliseconds between two checkpoint times (they are saved as text like "2026-11-21T10:00:00+00:00")."""
    if not start or not end:
        return None
    seconds = (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds()
    return round(seconds * 1000)
