from flask import Blueprint, jsonify, request

from models.whiteboard import find_whiteboard
from services import whiteboard_service
from services.whiteboard.questions import find_question

whiteboard_bp = Blueprint("whiteboard", __name__)

MAX_ELEMENTS = 3000  # shapes on one board
MAX_IMAGE = 4 * 1024 * 1024  # size of the board's picture: a PNG written out as text ("data:image/png;base64,...")
MAX_REPLY = 2000
MAX_QUESTION = 500


class BadRequest(Exception):
    """Something wrong in the request body. The route turns it into a 400 error with this message."""
    pass


def _read_board(data):
    """The drawing and its picture from the request body, checked."""
    scene = data.get("scene") or {}
    elements = scene.get("elements")
    if not isinstance(elements, list):
        raise BadRequest("scene.elements must be a list")
    if len(elements) > MAX_ELEMENTS:
        raise BadRequest(f"the board is too big (max {MAX_ELEMENTS} shapes)")

    image = data.get("image") or None
    if image is not None:
        if not isinstance(image, str) or not image.startswith("data:image/png;base64,"):
            raise BadRequest("image must be a PNG data URL")
        if len(image) > MAX_IMAGE:
            raise BadRequest("the board picture is too big")
    return {"elements": elements}, image


def _open_session(session_id):
    """Returns (session, None) when the round can go on, or (None, error response) when it doesn't
    exist or is already finished. The route returns that error response as it is."""
    session = find_whiteboard(session_id)
    if session is None:
        return None, (jsonify(error="whiteboard session not found"), 404)
    if session.status == "finished":
        return None, (jsonify(error="this round is finished"), 409)
    return session, None


@whiteboard_bp.get("/whiteboard/questions")
def list_questions():
    """GET /api/whiteboard/questions: the ready-made design questions."""
    return jsonify(questions=whiteboard_service.list_questions())


@whiteboard_bp.get("/whiteboard")
def list_sessions():
    """GET /api/whiteboard: your recent whiteboard rounds, newest first."""
    return jsonify(sessions=whiteboard_service.list_recent())


@whiteboard_bp.post("/whiteboard")
def start_session():
    """POST /api/whiteboard  {question_id} or {question, brief}: starts a round, and Bella greets you."""
    data = request.get_json(silent=True) or {}
    picked = find_question(data.get("question_id") or "")
    if picked:  # one of the ready-made questions
        question = picked["title"]
        brief = picked["brief"]
    else:  # your own question
        question = (data.get("question") or "").strip()
        brief = (data.get("brief") or "").strip()
    if not question:
        return jsonify(error="pick a question or write your own"), 400
    if len(question) > MAX_QUESTION or len(brief) > MAX_QUESTION:
        return jsonify(error=f"the question is too long (max {MAX_QUESTION} characters)"), 400
    return jsonify(whiteboard_service.start_whiteboard(question, brief)), 201


@whiteboard_bp.get("/whiteboard/<session_id>")
def get_session(session_id):
    """GET /api/whiteboard/<id>: one round: the question, your drawing, the conversation, and the report once
    it is finished."""
    session = find_whiteboard(session_id)
    if session is None:
        return jsonify(error="whiteboard session not found"), 404
    return jsonify(whiteboard_service.build_response(session))


@whiteboard_bp.put("/whiteboard/<session_id>/scene")
def save_scene(session_id):
    """PUT /api/whiteboard/<id>/scene  {scene}: saves your drawing without asking Bella, so a reload never
    loses it."""
    session, error = _open_session(session_id)
    if error:
        return error
    try:
        scene, _ = _read_board(request.get_json(silent=True) or {})
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    whiteboard_service.save_scene(session, scene)
    return jsonify(saved=True)


@whiteboard_bp.post("/whiteboard/<session_id>/review")
def review_board(session_id):
    """POST /api/whiteboard/<id>/review  {scene, image, reply}: Bella looks at the board (and your reply),
    and reacts."""
    session, error = _open_session(session_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    try:
        scene, image = _read_board(data)
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    reply = (data.get("reply") or "").strip()
    if len(reply) > MAX_REPLY:
        return jsonify(error=f"the reply is too long (max {MAX_REPLY} characters)"), 400
    return jsonify(whiteboard_service.review(session, scene, image, reply))


@whiteboard_bp.post("/whiteboard/<session_id>/finish")
def finish_session(session_id):
    """POST /api/whiteboard/<id>/finish  {scene, image}: ends the round and writes the report."""
    session, error = _open_session(session_id)
    if error:
        return error
    try:
        scene, image = _read_board(request.get_json(silent=True) or {})
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    return jsonify(whiteboard_service.finish(session, scene, image))
