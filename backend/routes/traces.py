from flask import Blueprint, jsonify, request

from models.trace import find_trace
from services import trace_service

traces_bp = Blueprint("traces", __name__)

MAX_PER_PAGE = 100


@traces_bp.get("/traces")
def list_traces():
    """GET /api/traces?page=2&per_page=20&label=coding_review (all optional): one page of AI calls, newest
    first."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = max(per_page, 1)  # at least 1...
    per_page = min(per_page, MAX_PER_PAGE)  # ...and at most 100
    label = request.args.get("label", "")
    return jsonify(trace_service.list_traces(page, per_page, label))


@traces_bp.get("/traces/<trace_id>")
def get_trace(trace_id):
    """GET /api/traces/<id>: one AI call in full: the exact prompt, the answer, the tokens and the time."""
    trace = find_trace(trace_id)
    if trace is None:
        return jsonify(error="trace not found"), 404
    return jsonify(trace_service.get_trace(trace))
