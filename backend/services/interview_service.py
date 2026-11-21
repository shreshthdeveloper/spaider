"""What the interview routes call.

The graph object holds no interview data. Every step of every interview is saved in MongoDB as a
LangGraph checkpoint, under thread_id = the interview id. So each request only says
"continue interview X", and LangGraph loads X's latest checkpoint before running.
"""
from functools import lru_cache

from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.types import Command
from mongoengine.connection import get_connection, get_db

from models.chat import utc_now
from models.interview import Interview
from services import voice
from services.interview.graph import build_interview_graph
from services.interview.xray import timeline


@lru_cache
def get_interview_graph():
    """Built once for the whole app. It saves its checkpoints in our MongoDB database."""
    checkpointer = MongoDBSaver(get_connection(), db_name=get_db().name)
    return build_interview_graph(checkpointer)


def _thread_config(interview):
    """Tells LangGraph which interview's checkpoints to load and save."""
    return {"configurable": {"thread_id": str(interview.id)}}


def start_interview(topic, num_questions, difficulty="mixed", max_follow_ups=1, mode="text", questions=None):
    """questions: a ready plan ([{"question", "key_points"}], e.g. from a question bank), or None to let the
    AI plan."""
    interview = Interview(
        topic=topic, num_questions=num_questions, difficulty=difficulty, max_follow_ups=max_follow_ups, mode=mode
    )
    interview.save()
    start_state = {
        "topic": topic,
        "num_questions": num_questions,
        "difficulty": difficulty,
        "max_follow_ups": max_follow_ups,
    }
    if questions:
        start_state["questions"] = questions
    try:
        # Runs plan_questions, then stops at the first question.
        get_interview_graph().invoke(start_state, _thread_config(interview))
    except Exception:
        interview.delete()  # don't keep an interview that never started
        raise

    if mode == "voice":
        # Make the voice for questions 2, 3... now, in the background, so each one plays at once when its
        # turn comes. (The browser asks for question 1 itself, right away.) Follow-ups can't be made early.
        planned = get_interview_graph().get_state(_thread_config(interview)).values["questions"]
        later_questions = []
        for item in planned[1:]:
            later_questions.append(item["question"])
        voice.prepare(later_questions)
    return build_response(interview)


def submit_answer(interview, text):
    """Resumes the paused interview with your answer."""
    return _continue_interview(interview, Command(resume={"action": "answer", "text": text}))


def end_interview(interview):
    """Resumes the paused interview with "end", so it goes straight to the report."""
    return _continue_interview(interview, Command(resume={"action": "end"}))


def retry_last_step(interview):
    """Continue after a step failed (for example, the AI was down). The saved answer is not lost.

    If the interview is just waiting for an answer, nothing changes and the same question comes back.
    """
    return _continue_interview(interview, None)


def answer_live(interview, text):
    """The same as submit_answer, but step by step (sent to the page as Server-Sent Events, see services/sse.py).

    Yields ("start", {"node": "grade"}) when a step begins and ("finish", {"node": "grade"}) when it ends,
    so the page can show what is happening and the X-ray can light up each step. Then ("done", the interview
    view), exactly what submit_answer returns. stream_mode="tasks" is LangGraph's "tell me when each step
    starts and finishes"."""
    graph = get_interview_graph()
    command = Command(resume={"action": "answer", "text": text})
    for task in graph.stream(command, _thread_config(interview), stream_mode="tasks"):
        if "result" in task:  # a finished step carries its result
            yield "finish", {"node": task["name"]}
        else:
            yield "start", {"node": task["name"]}
    _after_run(interview)
    yield "done", build_response(interview)


def xray(interview):
    """Every step the graph took so far, with what each one decided and why (services/interview/xray.py).
    Questions' key points stay hidden until the interview is finished, so the X-ray can't be used to peek."""
    reveal = interview.status == "finished"
    return timeline(get_interview_graph(), _thread_config(interview), reveal)


def _continue_interview(interview, graph_input):
    """Run the graph from where this interview stopped, until it asks the next question or finishes."""
    get_interview_graph().invoke(graph_input, _thread_config(interview))
    _after_run(interview)
    return build_response(interview)


def _after_run(interview):
    """After the graph stops: if it is not waiting for an answer, it ran all the way to END, so the
    interview is finished."""
    checkpoint = get_interview_graph().get_state(_thread_config(interview))
    if not checkpoint.interrupts:
        interview.status = "finished"
        interview.overall = checkpoint.values["report"]["overall"]
    interview.updated_at = utc_now()
    interview.save()


def build_response(interview):
    """The JSON the browser gets for this interview. Never the plan, or key points of questions not answered
    yet."""
    checkpoint = get_interview_graph().get_state(_thread_config(interview))  # the latest saved step
    state = checkpoint.values

    response = {
        "id": str(interview.id),
        "topic": interview.topic,
        "status": interview.status,
        "num_questions": interview.num_questions,
        "difficulty": interview.difficulty,
        "max_follow_ups": interview.max_follow_ups,
        "mode": interview.mode,
        "answered": len(state.get("results", [])),
        "question": None,
        "report": None,
        "results": [],
    }
    if checkpoint.interrupts:  # paused, waiting for an answer: send the question card
        response["question"] = checkpoint.interrupts[0].value
    if interview.status == "finished":
        response["report"] = state.get("report")
        response["results"] = state.get("results", [])
    return response


def list_recent_interviews(limit=20):
    """Your recent interviews, for the Past interviews tab."""
    interviews = []
    for interview in Interview.objects.order_by("-created_at").limit(limit):
        interviews.append({
            "id": str(interview.id),
            "topic": interview.topic,
            "status": interview.status,
            "overall": interview.overall,
            "num_questions": interview.num_questions,
            "mode": interview.mode,
            "created_at": interview.created_at.isoformat(),
        })
    return interviews
