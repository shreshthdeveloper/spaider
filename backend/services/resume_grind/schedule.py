"""When each claim comes back, and its colour. Plain rules, no AI:

    score 4 or 5  -> green,  asked again in 7 days
    score 3       -> yellow, asked again in 3 days
    score 0 to 2  -> red,    asked again tomorrow
    never asked   -> untested, asked today

So a weak line keeps coming back until you can defend it.
"""
from datetime import timedelta

from models.chat import utc_now

# (lowest score, colour, days until it is asked again), best first
LEVELS = [(4, "green", 7), (3, "yellow", 3), (0, "red", 1)]

# the order a grind picks claims in: weakest first
WEAKEST_FIRST = {"red": 0, "untested": 1, "yellow": 2, "green": 3}


def today():
    """Today's date as text, like "2026-11-22" (UTC). Dates written this way sort like the days they are."""
    return utc_now().date().isoformat()


def is_due(claim):
    """True if the claim should be asked today (or was due earlier)."""
    return claim["due"] <= today()


def pick_for_grind(claims, count):
    """The claims for the next grind: the ones due today first, weakest first. If fewer than `count` are due,
    the weakest of the others fill it up, so you can always practise."""
    due = []
    others = []
    for claim in claims:
        if is_due(claim):
            due.append(claim)
        else:
            others.append(claim)
    due.sort(key=_grind_order)
    others.sort(key=_grind_order)
    return (due + others)[:count]


def _grind_order(claim):
    """Sort key: claims that changed in the new version first, then red, untested, yellow, green, and the
    longest overdue first."""
    if claim["status"] == "changed":
        changed_first = 0
    else:
        changed_first = 1
    return (changed_first, WEAKEST_FIRST[claim["level"]], claim["due"])


def save_answer(claim, attempt):
    """Adds one grind answer to its claim, then sets the claim's score, colour and next day."""
    score = attempt["score"]
    for lowest, level, days in LEVELS:
        if score >= lowest:
            claim["level"] = level
            claim["due"] = (utc_now().date() + timedelta(days=days)).isoformat()
            break
    claim["score"] = score
    claim["status"] = "same"  # asked now, so no longer "new" or "changed"
    claim["attempts"].append(attempt)
