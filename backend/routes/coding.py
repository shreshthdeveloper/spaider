from flask import Blueprint, jsonify, request

from models.coding import find_coding
from services import coding_service
from services.coding.problems import DIFFICULTIES, find_problem

coding_bp = Blueprint("coding", __name__)

MODES = ["interview", "practice"]
MAX_CODE = 20000  # characters
MAX_REPLY = 2000
MAX_RESULTS = 50  # test results in one request


class BadRequest(Exception):
    """Something wrong in the request body. The route turns it into a 400 error with this message."""
    pass


def _read_code(data):
    """The code from the request body, checked: it must be text, and not too long."""
    code = data.get("code")
    if not isinstance(code, str):
        raise BadRequest("code must be text")
    if len(code) > MAX_CODE:
        raise BadRequest(f"the code is too long (max {MAX_CODE} characters)")
    return code


def _read_results(data):
    """The test results from the browser, keeping only the fields we use."""
    results = data.get("results") or []
    if not isinstance(results, list) or len(results) > MAX_RESULTS:
        raise BadRequest(f"results must be a list of at most {MAX_RESULTS} tests")
    clean = []
    for result in results:
        if not isinstance(result, dict):
            raise BadRequest("each test result must be an object")
        clean.append({
            "name": str(result.get("name", ""))[:100],
            "ok": result.get("ok") is True,
            "hidden": result.get("hidden") is True,
            "slow": result.get("slow") is True,
            "timed_out": result.get("timed_out") is True,
            "expected": str(result.get("expected", ""))[:300],
            "got": str(result.get("got", ""))[:300],
            "error": str(result.get("error", ""))[:300],
        })
    return clean


def _open_session(session_id):
    """Returns (session, None) when the round can go on, or (None, error response) when it doesn't
    exist or is already finished. The route returns that error response as it is."""
    session = find_coding(session_id)
    if session is None:
        return None, (jsonify(error="coding session not found"), 404)
    if session.status == "finished":
        return None, (jsonify(error="this round is finished"), 409)
    return session, None


@coding_bp.get("/coding/problems")
def list_problems():
    """GET /api/coding/problems: the problems for the setup screen (without their tests)."""
    return jsonify(problems=coding_service.list_problems())


@coding_bp.get("/coding")
def list_sessions():
    """GET /api/coding: your recent coding rounds, newest first."""
    return jsonify(sessions=coding_service.list_recent())


@coding_bp.post("/coding")
def start_session():
    """POST /api/coding  {problem_id or "surprise", difficulty, mode}: starts a round, and Bella greets you."""
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "interview")
    if mode not in MODES:
        return jsonify(error=f"mode must be one of {', '.join(MODES)}"), 400

    if data.get("problem_id") == "surprise":
        difficulty = data.get("difficulty") or ""
        if difficulty and difficulty not in DIFFICULTIES:
            return jsonify(error=f"difficulty must be one of {', '.join(DIFFICULTIES)}"), 400
        problem = coding_service.pick_problem(difficulty)
    else:
        problem = find_problem(data.get("problem_id") or "")
    if problem is None:
        return jsonify(error="pick a problem"), 400
    return jsonify(coding_service.start_coding(problem, mode)), 201


@coding_bp.get("/coding/<session_id>")
def get_session(session_id):
    """GET /api/coding/<id>: one round: the problem, your code, the conversation, and the report once it is
    finished."""
    session = find_coding(session_id)
    if session is None:
        return jsonify(error="coding session not found"), 404
    return jsonify(coding_service.build_response(session))


@coding_bp.put("/coding/<session_id>/code")
def save_code(session_id):
    """PUT /api/coding/<id>/code  {code}: saves your code without asking Bella, so a reload never loses it."""
    session, error = _open_session(session_id)
    if error:
        return error
    try:
        code = _read_code(request.get_json(silent=True) or {})
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    coding_service.save_code(session, code)
    return jsonify(saved=True)


@coding_bp.post("/coding/<session_id>/review")
def review_code(session_id):
    """POST /api/coding/<id>/review  {code, results, reply, hint}: Bella reads your code and test results,
    and reacts."""
    session, error = _open_session(session_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    try:
        code = _read_code(data)
        results = _read_results(data)
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    reply = (data.get("reply") or "").strip()
    if len(reply) > MAX_REPLY:
        return jsonify(error=f"the reply is too long (max {MAX_REPLY} characters)"), 400
    wants_hint = data.get("hint") is True
    return jsonify(coding_service.review(session, code, results, reply, wants_hint))


@coding_bp.post("/coding/<session_id>/finish")
def finish_session(session_id):
    """POST /api/coding/<id>/finish  {code, results}: ends the round and writes the report."""
    session, error = _open_session(session_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    try:
        code = _read_code(data)
        results = _read_results(data)
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    return jsonify(coding_service.finish(session, code, results))
