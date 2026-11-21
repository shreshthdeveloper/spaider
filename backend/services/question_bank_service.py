"""What the question bank routes call: start a panel, read a bank, and practise from it."""
from datetime import timedelta, timezone

from models.chat import utc_now
from models.question_bank import QuestionBank
from services import coding_service, interview_service, whiteboard_service
from services.coding.problems import find_problem
from services.question_bank.agents import AGENTS
from services.question_bank.runner import resume_run, start_run

STALE = timedelta(minutes=10)  # a run with no news for this long was cut off (e.g. the server restarted)
MAX_INTERVIEW_QUESTIONS = 20


class PracticeError(Exception):
    """The picked questions can't make one round. Shown to the user as it is."""


def list_agents():
    """Every agent: id, name, what it makes, how many questions, and its focus."""
    return AGENTS  # id, name, makes, count, focus


def create_bank(inputs, agent_ids, review=False):
    """Saves a new bank and starts its panel in the background."""
    bank = QuestionBank(title=_title(inputs), inputs=inputs, agent_ids=agent_ids, review=review)
    start_run(bank)  # saves the bank, then the panel works in the background
    return build_response(bank)


def resume(bank, decision):
    """Review mode: your answer to what the panel asked (bank.pending). The panel carries on from there."""
    resume_run(bank, decision)
    return build_response(bank)


def run_again(bank):
    """Runs the panel again on the same bank, with a fresh pipeline."""
    start_run(bank)
    return build_response(bank)


def practise(bank, question_ids, voice=False, coding_mode="interview"):
    """Starts a round from the picked questions:
    Q&A questions -> one mock interview with exactly those questions,
    one whiteboard question -> a whiteboard round, one coding problem -> a coding round."""
    picked = []
    for question in bank.questions:
        if question["id"] in question_ids:
            picked.append(question)
    kinds = set()
    for question in picked:
        kinds.add(question["type"])

    if kinds == {"qa"}:
        questions = []
        for question in picked[:MAX_INTERVIEW_QUESTIONS]:
            questions.append({"question": question["question"], "key_points": question["key_points"]})
        mode = "voice" if voice else "text"
        view = interview_service.start_interview(bank.title, len(questions), mode=mode, questions=questions)
        page = f"interview/{view['id']}"
    elif kinds == {"whiteboard"} and len(picked) == 1:
        view = whiteboard_service.start_whiteboard(picked[0]["question"], picked[0]["detail"])
        page = f"whiteboard/{view['id']}"
    elif kinds == {"coding"} and len(picked) == 1 and find_problem(picked[0]["problem_id"]):
        view = coding_service.start_coding(find_problem(picked[0]["problem_id"]), coding_mode)
        page = f"coding/{view['id']}"
    else:
        raise PracticeError("Pick Q&A questions for a mock interview, or one whiteboard or coding question.")

    picked_ids = []
    for question in picked:
        picked_ids.append(question["id"])
    bank.practised.append({"question_ids": picked_ids, "page": page, "at": utc_now().isoformat()})
    bank.save()
    return {"page": page}


def build_response(bank):
    """The JSON the browser gets for a bank. The JD and resume texts stay on the server; it only says whether
    they were given."""
    _mark_if_cut_off(bank)
    inputs = bank.inputs or {}
    return {
        "id": str(bank.id),
        "title": bank.title,
        "status": bank.status,
        "error": bank.error,
        "inputs": {
            "company": inputs.get("company", ""),
            "position": inputs.get("position", ""),
            "interview_type": inputs.get("interview_type", ""),
            "level": inputs.get("level", ""),
            "topics": inputs.get("topics", ""),
            "has_jd": bool(inputs.get("jd")),
            "has_resume": bool(inputs.get("resume")),
            "documents": inputs.get("documents", []),
        },
        "agent_ids": bank.agent_ids,
        "review": bank.review,
        "pending": bank.pending or None,  # what the panel is asking you, while it waits (review mode)
        "steps": bank.steps,
        "plan": bank.plan,
        "summary": bank.summary,
        "questions": bank.questions,
        "dropped": bank.dropped,
        "practised": bank.practised,
        "created_at": bank.created_at.isoformat(),
    }


def list_recent(limit=30):
    """Your recent banks for the Past banks tab, with how many questions of each type."""
    banks = []
    recent = QuestionBank.objects.order_by("-created_at").limit(limit)
    # newest first; .only(...) loads just the fields the list shows
    for bank in recent.only("title", "status", "agent_ids", "questions", "inputs", "created_at"):
        counts = {"qa": 0, "whiteboard": 0, "coding": 0}
        for question in bank.questions:
            counts[question["type"]] += 1
        banks.append({
            "id": str(bank.id),
            "title": bank.title,
            "status": bank.status,
            "agents": len(bank.agent_ids),
            "level": (bank.inputs or {}).get("level", ""),
            "counts": counts,
            "created_at": bank.created_at.isoformat(),
        })
    return banks


def _title(inputs):
    """For example: Backend Engineer at Damco."""
    if inputs["position"] and inputs["company"]:
        return f"{inputs['position']} at {inputs['company']}"
    return inputs["position"] or inputs["company"] or "Question bank"


def _mark_if_cut_off(bank):
    """A bank still "running" with no news for a long time was cut off, e.g. by a server restart.
    (A bank waiting for you, "needs_you", can wait as long as you like.)"""
    if bank.status != "running":
        return
    updated = bank.updated_at
    if updated.tzinfo is None:  # MongoDB gives back plain UTC times
        updated = updated.replace(tzinfo=timezone.utc)
    if utc_now() - updated > STALE:
        bank.status = "failed"
        bank.error = "The panel was cut off (did the server restart?). Run it again."
        bank.save()
