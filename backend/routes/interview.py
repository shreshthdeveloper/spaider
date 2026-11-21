from flask import Blueprint, jsonify, request

from models.interview import find_interview
from services import interview_service
from services.sse import sse_response

interview_bp = Blueprint("interview", __name__)

MAX_TOPIC_LENGTH = 4000   # a pasted job description fits
MAX_ANSWER_LENGTH = 5000
MAX_QUESTIONS = 20
DIFFICULTIES = ["easy", "medium", "hard", "mixed"]
MODES = ["text", "voice"]


@interview_bp.post("/interviews")
def start_interview():
    """POST /api/interviews  {topic, num_questions, difficulty, follow_ups, mode}: plans the questions and
    returns the first one."""
    data = request.get_json(silent=True) or {}
    topic = (data.get("topic") or "").strip()
    num_questions = data.get("num_questions", 5)
    difficulty = data.get("difficulty", "mixed")
    follow_ups = data.get("follow_ups", 1)
    mode = data.get("mode", "text")

    if not topic:
        return jsonify(error="topic is required"), 400
    if len(topic) > MAX_TOPIC_LENGTH:
        return jsonify(error=f"topic is too long (max {MAX_TOPIC_LENGTH} characters)"), 400
    if not isinstance(num_questions, int) or not 1 <= num_questions <= MAX_QUESTIONS:
        return jsonify(error=f"num_questions must be a whole number from 1 to {MAX_QUESTIONS}"), 400
    if difficulty not in DIFFICULTIES:
        return jsonify(error=f"difficulty must be one of {DIFFICULTIES}"), 400
    if not isinstance(follow_ups, int) or not 0 <= follow_ups <= 2:
        return jsonify(error="follow_ups must be 0, 1 or 2"), 400
    if mode not in MODES:
        return jsonify(error=f"mode must be one of {MODES}"), 400

    interview = interview_service.start_interview(topic, num_questions, difficulty, follow_ups, mode)
    return jsonify(interview), 201


@interview_bp.get("/interviews")
def list_interviews():
    """GET /api/interviews: your recent interviews, newest first."""
    return jsonify(interviews=interview_service.list_recent_interviews())


@interview_bp.get("/interviews/<interview_id>")
def get_interview(interview_id):
    """GET /api/interviews/<id>: the current question while it runs, or the report once it is finished."""
    interview = find_interview(interview_id)
    if interview is None:
        return jsonify(error="interview not found"), 404
    return jsonify(interview_service.build_response(interview))


def _read_answer(interview_id):
    """Returns (interview, answer text, None) when the answer can be graded, or (None, None, error response)."""
    interview = find_interview(interview_id)
    if interview is None:
        return None, None, (jsonify(error="interview not found"), 404)
    if interview.status == "finished":
        return None, None, (jsonify(error="this interview is already finished"), 409)

    data = request.get_json(silent=True) or {}
    text = (data.get("answer") or "").strip()
    if not text:
        return None, None, (jsonify(error="answer is required"), 400)
    if len(text) > MAX_ANSWER_LENGTH:
        return None, None, (jsonify(error=f"answer is too long (max {MAX_ANSWER_LENGTH} characters)"), 400)
    return interview, text, None


@interview_bp.post("/interviews/<interview_id>/answer")
def answer_question(interview_id):
    """POST /api/interviews/<id>/answer  {answer}: grades your answer, and returns the next question (or the
    report)."""
    interview, text, error = _read_answer(interview_id)
    if error:
        return error
    return jsonify(interview_service.submit_answer(interview, text))


@interview_bp.post("/interviews/<interview_id>/answer/live")
def answer_question_live(interview_id):
    """POST /api/interviews/<id>/answer/live  {answer}: the same as /answer, but as a live stream
    (Server-Sent Events): "start" and "finish" for each step of the graph as it runs, then "done" with the
    next question (or the report)."""
    interview, text, error = _read_answer(interview_id)
    if error:
        return error
    return sse_response(interview_service.answer_live(interview, text))


@interview_bp.get("/interviews/<interview_id>/xray")
def interview_xray(interview_id):
    """GET /api/interviews/<id>/xray: every step the interview graph took, with what it decided and why."""
    interview = find_interview(interview_id)
    if interview is None:
        return jsonify(error="interview not found"), 404
    return jsonify(interview_service.xray(interview))


@interview_bp.post("/interviews/<interview_id>/end")
def end_interview(interview_id):
    """POST /api/interviews/<id>/end: stops early and writes the report from what you answered so far."""
    interview = find_interview(interview_id)
    if interview is None:
        return jsonify(error="interview not found"), 404
    if interview.status == "finished":
        return jsonify(error="this interview is already finished"), 409

    return jsonify(interview_service.end_interview(interview))


@interview_bp.post("/interviews/<interview_id>/retry")
def retry_interview(interview_id):
    """POST /api/interviews/<id>/retry: runs the last step again after it failed (for example, the AI was
    down)."""
    interview = find_interview(interview_id)
    if interview is None:
        return jsonify(error="interview not found"), 404
    if interview.status == "finished":
        return jsonify(error="this interview is already finished"), 409

    return jsonify(interview_service.retry_last_step(interview))
