"""The flies on your web: what is waiting for you. Each one links to the page where you deal with it.
All of it is worked out from what the rounds already saved; nothing new is stored, so a better
next round clears a weak spot by itself."""
from datetime import timedelta
from urllib.parse import quote

from models.chat import utc_now
from models.coding import CodingSession
from models.interview import Interview
from models.whiteboard import WhiteboardSession
from services.coding.problems import find_problem

MAX_FLIES = 8  # one per spoke of the web
MAX_UNFINISHED = 3
UNFINISHED_DAYS = 14  # rounds left open for longer than this are forgotten
WEAK_LEVELS = ("missing", "basic")
WEAK_PER_ROUND = 2
WEAK_INTERVIEW = 3  # an interview that scored below this (out of 5) is worth doing again


def web_tasks(done_today, bank_done_today):
    """The flies on the web, most important first: today, the next bank, unfinished rounds, then weak spots."""
    latest = {
        "interview": _latest(Interview),
        "coding": _latest(CodingSession),
        "whiteboard": _latest(WhiteboardSession),
    }
    flies = [_today(done_today), _bank(next_topic(latest), bank_done_today)]
    flies += unfinished_rounds()
    flies += weak_spots(latest)
    return flies[:MAX_FLIES]


def unfinished_rounds():
    """Rounds you started in the last two weeks but never finished, newest first."""
    since = utc_now() - timedelta(days=UNFINISHED_DAYS)
    found = []  # (started at, fly)
    # created_at__gte=since is MongoEngine for "created_at >= since" (gte = greater than or equal)

    for interview in Interview.objects(status="in_progress", created_at__gte=since).only("topic", "created_at"):
        found.append((interview.created_at, _fly(
            f"open-interview-{interview.id}", "unfinished", "Finish your interview",
            _short(interview.topic), f"interview/{interview.id}",
        )))

    for board in WhiteboardSession.objects(status="drawing", created_at__gte=since).only("question", "created_at"):
        found.append((board.created_at, _fly(
            f"open-whiteboard-{board.id}", "unfinished", "Finish your whiteboard",
            _short(board.question), f"whiteboard/{board.id}",
        )))

    for coding in CodingSession.objects(status="coding", created_at__gte=since).only("problem_id", "created_at"):
        found.append((coding.created_at, _fly(
            f"open-coding-{coding.id}", "unfinished", "Finish your coding round",
            _problem_title(coding.problem_id), f"coding/{coding.id}",
        )))

    found.sort(key=_started_at, reverse=True)  # newest first
    flies = []
    for _, fly in found[:MAX_UNFINISHED]:
        flies.append(fly)
    return flies


def weak_spots(latest):
    """Where your latest round of each kind was weak."""
    flies = []

    interview = latest["interview"]
    if interview and interview.overall is not None and interview.overall < WEAK_INTERVIEW:
        flies.append(_fly(
            f"weak-interview-{interview.id}", "weak", f"Redo: {_short(interview.topic, 28)}",
            f"Your last interview scored {interview.overall} / 5.", "interview",
        ))

    coding = latest["coding"]
    if coding:
        title = _problem_title(coding.problem_id)
        for area in _weak_areas(coding.report):
            flies.append(_fly(
                f"weak-coding-{area['area']}", "weak", f"Coding: {area['area']}",
                f"{title} was rated {area['level']}. Next time: {area['looks_for']}.", "coding",
            ))

    board = latest["whiteboard"]
    if board:
        for area in _weak_areas(board.report):
            flies.append(_fly(
                f"weak-whiteboard-{area['area']}", "weak", f"Design: {area['area']}",
                f"Your last design was rated {area['level']}. Next time: {area['looks_for']}.", "whiteboard",
            ))

    return flies


def next_topic(latest):
    """What your next question bank could be about: your weakest recent topic, or Python if there's nothing
    yet."""
    interview = latest["interview"]
    coding = latest["coding"]
    board = latest["whiteboard"]
    if interview and interview.overall is not None and interview.overall < WEAK_INTERVIEW:
        return _short(interview.topic)
    if coding and _weak_areas(coding.report):
        problem = find_problem(coding.problem_id)
        if problem:
            return problem["topic"]
        return "Python"
    if board and _weak_areas(board.report):
        weakest = _weak_areas(board.report)[0]
        return f"system design: {weakest['area'].lower()}"
    if interview:
        return _short(interview.topic)
    return "Python basics"


def _today(done):
    """The practise-today fly (ticked once you have practised today)."""
    if done:
        return _fly("today", "today", "Today: done", "You practised today. Your streak is safe.", "stats", done=True)
    return _fly("today", "today", "Practise today", "Finish one round to keep your streak.", "interview")


def _bank(topic, done):
    """The make-a-question-bank fly, on your weakest recent topic."""
    if done:
        return _fly("bank", "bank", "Question bank: done", "You made a question bank today.", "bank", done=True)
    return _fly("bank", "bank", f"Question bank: {topic}", "Let the agent panel prepare questions on this.",
                f"bank?topic={quote(topic)}")


def _fly(fly_id, kind, title, detail, link, done=False):
    """kind: today | bank | unfinished | weak. link: the page to open, e.g. "coding/<id>"."""
    return {"id": fly_id, "kind": kind, "title": title, "detail": detail, "link": link, "done": done}


def _latest(model):
    """Your most recently finished round of this kind, or None."""
    return model.objects(status="finished").order_by("-updated_at").first()


def _weak_areas(report):
    """The weakest rubric areas of a report (the ones rated missing or basic), at most WEAK_PER_ROUND."""
    if not report:
        return []
    areas = []
    for area in report.get("areas", []):
        if area.get("level") in WEAK_LEVELS:
            areas.append(area)
    areas.sort(key=_points)  # the weakest first
    return areas[:WEAK_PER_ROUND]


def _problem_title(problem_id):
    """A coding problem's title (or its id, if the problem no longer exists)."""
    problem = find_problem(problem_id)
    if problem is None:
        return problem_id
    return problem["title"]


def _short(text, limit=40):
    """The first line of a topic or question, cut to fit on the web."""
    lines = (text or "").strip().splitlines()
    if not lines:
        return ""
    first = lines[0].strip()
    if len(first) <= limit:
        return first
    return first[: limit - 1].rstrip() + "…"


def _started_at(pair):
    """Sort key: when the round started."""
    return pair[0]


def _points(area):
    """Sort key: a rubric area's points."""
    return area.get("points", 0)
