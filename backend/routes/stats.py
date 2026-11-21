from flask import Blueprint, jsonify, request

from services import stats_service

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/stats")
def get_stats():
    """GET /api/stats?minutes_ahead=330: your streak, your spider's health, and the tasks on your web."""
    # ?minutes_ahead=330 is your time zone (India is 5 h 30 min ahead of UTC), so "today" means your today
    minutes_ahead = request.args.get("minutes_ahead", 0, type=int)
    minutes_ahead = max(minutes_ahead, -12 * 60)  # no time zone is more than 12 hours behind UTC...
    minutes_ahead = min(minutes_ahead, 14 * 60)  # ...or 14 hours ahead
    return jsonify(stats_service.get_stats(minutes_ahead))
