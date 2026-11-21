from flask import Blueprint, jsonify, request

from evals.suites import SUITES
from models.eval_run import find_eval_run
from services import eval_service

evals_bp = Blueprint("evals", __name__)


@evals_bp.get("/evals")
def list_evals():
    """GET /api/evals: what each suite tests, and the latest runs (without their cases)."""
    return jsonify(suites=eval_service.list_suites(), runs=eval_service.list_runs())


@evals_bp.post("/evals")
def run_eval():
    """POST /api/evals  {suite}: runs a suite in the background. It calls the real AI, so it costs a little
    (see ai_calls in GET /api/evals)."""
    suite = (request.get_json(silent=True) or {}).get("suite")
    if suite not in SUITES:
        return jsonify(error=f"suite must be one of {', '.join(SUITES)}"), 400
    return jsonify(eval_service.start_run(suite)), 201


@evals_bp.get("/evals/<run_id>")
def get_eval(run_id):
    """GET /api/evals/<id>: one run with every case: what you expected, and what the AI did."""
    run = find_eval_run(run_id)
    if run is None:
        return jsonify(error="eval run not found"), 404
    return jsonify(eval_service.build_response(run))
