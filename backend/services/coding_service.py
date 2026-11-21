"""What the coding routes call: start a round, save the code, review it, finish with a report."""
import random

from models.chat import utc_now
from models.coding import CodingSession
from services.coding.problems import PROBLEMS, find_problem
from services.coding.report import write_report
from services.coding.review import review_code


def list_problems():
    """The problems for the setup screen. The tests stay out of it, so nobody can peek at the answers."""
    problems = []
    for problem in PROBLEMS:
        problems.append({
            "id": problem["id"],
            "title": problem["title"],
            "difficulty": problem["difficulty"],
            "topic": problem["topic"],
        })
    return problems


def pick_problem(difficulty=""):
    """'Surprise me': a problem you have not finished yet, at this difficulty if one is given."""
    finished = CodingSession.objects(status="finished").distinct("problem_id")

    choices = []  # the problems at this difficulty (every problem if no difficulty is given)
    for problem in PROBLEMS:
        if not difficulty or problem["difficulty"] == difficulty:
            choices.append(problem)

    not_done = []  # ...that you have not finished yet
    for problem in choices:
        if problem["id"] not in finished:
            not_done.append(problem)

    if not_done:
        return random.choice(not_done)
    return random.choice(choices)  # you finished them all: any one again


def start_coding(problem, mode):
    """Creates the round with the problem's starter code, and Bella's greeting."""
    session = CodingSession(problem_id=problem["id"], mode=mode, code=problem["starter"])
    session.messages = [_message("interviewer", _greeting(problem, mode))]
    session.save()
    return build_response(session)


def save_code(session, code):
    """Saves the code without a review, so a page reload never loses it."""
    session.code = code
    session.updated_at = utc_now()
    session.save()


def review(session, code, results, reply="", wants_hint=False):
    """Bella reads the code (and your reply, or your hint request) and reacts."""
    session.code = code
    if reply:
        session.messages.append(_message("candidate", reply))
    elif wants_hint:
        session.messages.append(_message("candidate", "Can I get a hint?"))
    session.save()  # keep your words even if the AI step fails

    result = review_code(session, find_problem(session.problem_id), code, results, reply, wants_hint)
    if wants_hint:
        session.hints_used += 1
    session.messages.append(_message("interviewer", result["say"]))
    session.updated_at = utc_now()
    session.save()
    return {"say": result["say"], "notes": result["notes"], "session": build_response(session)}


def finish(session, code, results):
    """Saves the final code, writes the report, and closes the round."""
    report = write_report(session, find_problem(session.problem_id), code, results)
    session.code = code
    session.report = report
    session.overall = report["overall"]
    session.status = "finished"
    session.updated_at = utc_now()
    session.save()
    return build_response(session)


def build_response(session):
    """The JSON the browser gets for a round. The best approach stays hidden until the report."""
    problem = dict(find_problem(session.problem_id))
    problem.pop("best", None)  # the best approach is shown in the report, not during the round
    return {
        "id": str(session.id),
        "problem": problem,
        "mode": session.mode,
        "status": session.status,
        "code": session.code,
        "messages": session.messages,
        "hints_used": session.hints_used,
        "report": session.report or None,
        "overall": session.overall,
        "created_at": session.created_at.isoformat(),
    }


def list_recent(limit=30):
    """Your recent rounds, for the Past rounds list."""
    sessions = []
    # newest first; .only(...) loads just the fields the list shows
    for session in CodingSession.objects.order_by("-created_at").only(
        "problem_id", "mode", "status", "overall", "created_at"
    ).limit(limit):
        problem = find_problem(session.problem_id) or {}
        sessions.append({
            "id": str(session.id),
            "title": problem.get("title", session.problem_id),
            "difficulty": problem.get("difficulty", ""),
            "mode": session.mode,
            "status": session.status,
            "overall": session.overall,
            "created_at": session.created_at.isoformat(),
        })
    return sessions


def _greeting(problem, mode):
    """How Bella opens the round, in each mode."""
    if mode == "practice":
        return (
            f"Hi, I'm Bella. This is a practice round, so today I'm your coach, not your judge. "
            f"The problem is {problem['title']}, it's on the left. Tell me your first idea, and ask me for "
            "a hint any time. Run the tests whenever you like."
        )
    return (
        f"Hi, I'm Bella, a senior engineer here, and I'll be your interviewer today. Today's problem is "
        f"{problem['title']}, it's on the left. Before you write any code, tell me how you'd approach it "
        "and what the time complexity would be. Run the tests whenever you like."
    )


def _message(role, text):
    """One line of the conversation, with the time it was said."""
    return {"role": role, "text": text, "at": utc_now().isoformat()}
