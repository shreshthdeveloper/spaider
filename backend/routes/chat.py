from flask import Blueprint, jsonify, request

from services import chat_service

chat_bp = Blueprint("chat", __name__)


@chat_bp.post("/chat")
def chat():
    """POST /api/chat  {message, session_id}: sends a message (to a new chat when there is no session_id) and
    returns the AI's reply."""
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    session_id = data.get("session_id")

    if not message:
        return jsonify(error="message is required"), 400
    if session_id is not None and not isinstance(session_id, str):
        return jsonify(error="session_id must be a string"), 400

    return jsonify(chat_service.reply(message, session_id))


@chat_bp.get("/chat/<session_id>")
def chat_history(session_id):
    """GET /api/chat/<id>: every message of one chat, to show it again after a reload."""
    messages = chat_service.get_history(session_id)
    if messages is None:
        return jsonify(error="chat not found"), 404
    return jsonify(session_id=session_id, messages=messages)

