"""How your spider feels: health starts at 100, and every reason she loses points is listed."""

PER_MISSED_DAY = 35  # each whole day you skipped...
MAX_MISSED_COST = 100  # ...up to this much
NOT_YET_TODAY = 15  # you haven't practised today yet
PER_OPEN_TASK = 5  # each unfinished round or weak spot left on your web...
MAX_TASK_COST = 30  # ...up to this much

# The kinds of fly that pile up on the web when you ignore them (see web.py).
PILES_UP = ("unfinished", "weak")

# Her mood for a score: the first one whose floor the score reaches.
MOODS = [(80, "happy"), (55, "okay"), (30, "itchy"), (0, "angry")]


def health(streak, flies):
    """Her health score (100 minus every reason), her mood, and the list of reasons."""
    reasons = []

    missed = streak["missed_days"]
    if missed:
        cost = min(MAX_MISSED_COST, PER_MISSED_DAY * missed)
        reasons.append({"text": f"{_plural(missed, 'day')} without practice", "points": cost})

    if not streak["done_today"]:
        reasons.append({"text": "No practice yet today", "points": NOT_YET_TODAY})

    open_tasks = []
    for fly in flies:
        if fly["kind"] in PILES_UP:
            open_tasks.append(fly)
    if open_tasks:
        cost = min(MAX_TASK_COST, PER_OPEN_TASK * len(open_tasks))
        reasons.append({"text": f"{_plural(len(open_tasks), 'task')} left on your web", "points": cost})

    lost = 0
    for reason in reasons:
        lost += reason["points"]
    score = max(0, 100 - lost)
    return {"score": score, "mood": _mood(score), "reasons": reasons}


def _mood(score):
    """The mood for a health score: happy, okay, itchy or angry."""
    for floor, name in MOODS:
        if score >= floor:
            return name
    return "angry"


def _plural(count, word):
    """For example: 1 day, 3 days."""
    return f"{count} {word}" if count == 1 else f"{count} {word}s"
