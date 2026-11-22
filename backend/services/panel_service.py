"""What the panel interview routes call. Like the mock interview, each request only says "carry on panel X":
LangGraph loads X's latest checkpoint from MongoDB, runs until the next question (or the end), and saves.
"""
from functools import lru_cache

from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.types import Command
from mongoengine.connection import get_connection, get_db

from models.chat import utc_now
from models.panel import PanelInterview
from services import voice
from services.panel.graph import build_panel_graph
from services.panel.panelists import PANELISTS, find_panelist


@lru_cache
def get_panel_graph():
    """Built once for the whole app. It saves its checkpoints in our MongoDB database."""
    checkpointer = MongoDBSaver(get_connection(), db_name=get_db().name)
    return build_panel_graph(checkpointer)


def _thread_config(panel):
    """Tells LangGraph which panel's checkpoints to load and save."""
    return {"configurable": {"thread_id": str(panel.id)}}


def list_panelists():
    """Everyone who can sit on a panel: id, name, title, focus."""
    return PANELISTS


def start_panel(inputs, panelist_ids, num_questions, max_follow_ups, mode="voice"):
    """Saves a new panel interview, runs the brief, and stops at the first question. In a video call (voice),
    each panelist's planned questions are turned into their voice in the background, so they play at once."""
    panel = []
    for panelist_id in panelist_ids:
        panel.append(find_panelist(panelist_id))

    record = PanelInterview(
        title=_title(inputs),
        inputs=inputs,
        panelist_ids=panelist_ids,
        num_questions=num_questions,
        max_follow_ups=max_follow_ups,
        mode=mode,
    )
    record.save()
    start_state = {
        "inputs": inputs,
        "panel": panel,
        "num_questions": num_questions,
        "max_follow_ups": max_follow_ups,
        "intros": _intros(panel, inputs),
        "transcript": [],
        "results": [],
        "notes": [],
        "decisions": [],
        "verdicts": [],
    }
    try:
        get_panel_graph().invoke(start_state, _thread_config(record))
    except Exception:
        record.delete()  # don't keep a panel that never started
        raise
    if mode == "voice":
        _prepare_voices(record)
    return build_response(record)


def _intros(panel, inputs):
    """The round of introductions at the start: the first panelist welcomes you, then each one says who they are
    and what they'll ask about. Fixed words (no AI), so they're instant and their voices can be made early."""
    if inputs.get("company"):
        welcome = f"Hi, and welcome to {inputs['company']}. Thanks for joining us today."
    else:
        welcome = "Hi, and thanks for joining us today."
    intros = []
    for index, panelist in enumerate(panel):
        text = panelist["intro"]
        if index == 0:
            text = f"{welcome} {text}"
        if index == len(panel) - 1:
            text += " Let's begin."
        intros.append({"speaker": panelist["id"], "voice": panelist["voice"], "text": text})
    return intros


def _prepare_voices(record):
    """Makes the introductions and every panelist's planned questions in their own voice, in the background.
    (The browser asks for the first introduction itself, right away. Follow-ups can't be made early.)"""
    state = get_panel_graph().get_state(_thread_config(record)).values
    for panelist in state["panel"]:
        texts = []
        for intro in state["intros"][1:]:
            if intro["speaker"] == panelist["id"]:
                texts.append(intro["text"])
        for planned in state["plan"][panelist["id"]]:
            texts.append(planned["question"])
        voice.prepare(texts, panelist.get("voice", ""))


def answer_live(record, text):
    """Your answer, then every step as it runs (sent to the page as Server-Sent Events, see services/sse.py):
    ("start", {"id", "node", "who"}) when a step begins and ("finish", {"id"}) when it ends. "who" is the
    panelist the step is about, so the page can show "Arjun is writing a note…" on Arjun's tile. The ids
    match each start with its finish, because the panelists' steps run at the same time. Last comes
    ("done", the panel as build_response returns it)."""
    command = Command(resume={"action": "answer", "text": text})
    for task in get_panel_graph().stream(command, _thread_config(record), stream_mode="tasks"):
        if "result" in task or "error" in task:  # a finished step
            yield "finish", {"id": task["id"]}
        else:
            yield "start", {"id": task["id"], "node": task["name"], "who": _who(task)}
    _after_run(record)
    yield "done", build_response(record)


def end_panel(record):
    """Stops early: the panelists give their verdicts on what you answered so far."""
    get_panel_graph().invoke(Command(resume={"action": "end"}), _thread_config(record))
    _after_run(record)
    return build_response(record)


def retry_last_step(record):
    """Carries on after a step failed (for example, the AI was down). Your saved answer is not lost."""
    get_panel_graph().invoke(None, _thread_config(record))
    _after_run(record)
    return build_response(record)


def _after_run(record):
    """After the graph stops: if it isn't waiting for an answer, it ran to the end, so the panel is finished."""
    checkpoint = get_panel_graph().get_state(_thread_config(record))
    if not checkpoint.interrupts and checkpoint.values.get("report"):
        record.status = "finished"
        record.overall = checkpoint.values["report"]["overall"]
        record.decision = checkpoint.values["report"]["decision"]
    record.updated_at = utc_now()
    record.save()


def _who(task):
    """The panelist a step is about: the one writing a note or a verdict, or the one grading. "" otherwise."""
    data = task.get("input") or {}
    if "panelist" in data:
        return data["panelist"]["id"]
    if task["name"] == "grade" and data.get("turn"):
        return data["turn"]["speaker"]
    return ""


def build_response(record):
    """The JSON the page gets. While the panel runs: the conversation and the current question (scores and
    verdicts stay hidden until the end). The private notes are always sent: the page shows them only if you
    turn on "Show the panel's notes"."""
    checkpoint = get_panel_graph().get_state(_thread_config(record))
    state = checkpoint.values

    response = {
        "id": str(record.id),
        "title": record.title,
        "status": record.status,
        "num_questions": record.num_questions,
        "max_follow_ups": record.max_follow_ups,
        "mode": record.mode,
        "panel": state.get("panel", []),
        "intros": state.get("intros", []),
        "transcript": state.get("transcript", []),
        "notes": state.get("notes", []),
        "decisions": state.get("decisions", []),
        "answered": len(state.get("results", [])),
        "question": None,
        "results": [],
        "verdicts": [],
        "report": None,
    }
    if checkpoint.interrupts:  # waiting for your answer
        response["question"] = checkpoint.interrupts[0].value
    if record.status == "finished":
        response["results"] = state.get("results", [])
        response["verdicts"] = state.get("verdicts", [])
        response["report"] = state.get("report")
    return response


def list_recent_panels(limit=20):
    """Your recent panel interviews, for the Past panels tab."""
    panels = []
    for record in PanelInterview.objects.order_by("-created_at").limit(limit):
        panels.append({
            "id": str(record.id),
            "title": record.title,
            "status": record.status,
            "overall": record.overall,
            "decision": record.decision,
            "panelist_ids": record.panelist_ids,
            "num_questions": record.num_questions,
            "created_at": record.created_at.isoformat(),
        })
    return panels


def _title(inputs):
    """"Backend Engineer at Damco", or as much of it as was given."""
    role = inputs.get("role") or "Panel interview"
    if inputs.get("company"):
        return f"{role} at {inputs['company']}"
    return role
