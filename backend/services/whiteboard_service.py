"""What the whiteboard routes call: start a round, save the drawing, review it, finish with a report."""
from models.chat import utc_now
from models.whiteboard import WhiteboardSession
from services.whiteboard.questions import QUESTIONS
from services.whiteboard.report import write_report
from services.whiteboard.review import review_board


def list_questions():
    """The ready-made design questions."""
    return QUESTIONS


def start_whiteboard(question, brief):
    """Creates the round with Bella's greeting."""
    session = WhiteboardSession(question=question, brief=brief)
    session.messages = [_message("interviewer", _greeting(question, brief))]
    session.save()
    return build_response(session)


def save_scene(session, scene):
    """Saves the drawing without a review, so a page reload never loses it."""
    session.scene = scene
    session.updated_at = utc_now()
    session.save()


def review(session, scene, image, reply=""):
    """The interviewer looks at the board (and your reply, if you said something) and reacts."""
    session.scene = scene
    if reply:
        session.messages.append(_message("candidate", reply))
        session.save()  # keep your reply even if the AI step fails

    result = review_board(session, scene, image, reply)
    session.messages.append(_message("interviewer", result["say"]))
    session.updated_at = utc_now()
    session.save()
    return {"say": result["say"], "notes": result["notes"], "session": build_response(session)}


def finish(session, scene, image):
    """Saves the final board and its picture, writes the report, and closes the round."""
    report = write_report(session, scene, image)
    session.scene = scene
    session.final_image = image
    session.report = report
    session.overall = report["overall"]
    session.status = "finished"
    session.updated_at = utc_now()
    session.save()
    return build_response(session)


def build_response(session):
    """The JSON the browser gets for a round."""
    return {
        "id": str(session.id),
        "question": session.question,
        "brief": session.brief,
        "status": session.status,
        "scene": session.scene or {"elements": []},
        "messages": session.messages,
        "report": session.report or None,
        "overall": session.overall,
        "final_image": session.final_image,
        "created_at": session.created_at.isoformat(),
    }


def list_recent(limit=30):
    """Your recent rounds, for the Past rounds list."""
    sessions = []
    # newest first; .only(...) loads just the fields the list shows
    for session in WhiteboardSession.objects.order_by("-created_at").only(
        "question", "status", "overall", "created_at"
    ).limit(limit):
        sessions.append({
            "id": str(session.id),
            "question": session.question,
            "status": session.status,
            "overall": session.overall,
            "created_at": session.created_at.isoformat(),
        })
    return sessions


def _greeting(question, brief):
    """How Bella opens the round: who she is, the question, and how to start. Like a real interviewer."""
    task = question.strip().rstrip(".")
    if task.lower().startswith("design "):
        task_line = f"Today, let's {task[0].lower()}{task[1:]}."
    else:
        end = "" if task.endswith(("?", "!")) else "."
        task_line = f"Today's question: {task}{end}"
    return (
        "Hi, I'm Bella, a senior engineer here, and I'll be your interviewer today. "
        f"{task_line} {brief} "
        "There's no single right answer, so think out loud. Start with what the system must do and how big it gets, "
        "then sketch the main parts on the board. I'll look in as you go."
    ).replace("  ", " ")  # an empty brief would leave two spaces in a row


def _message(role, text):
    """One line of the conversation, with the time it was said."""
    return {"role": role, "text": text, "at": utc_now().isoformat()}
