from flask import Blueprint, jsonify

import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    """Is the backend up, and can it reach MongoDB? The sidebar checks this every 15 seconds."""
    mongo = "down"
    if db.is_up():
        mongo = "ok"
    return jsonify(status="ok", mongo=mongo)
