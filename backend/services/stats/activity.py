"""What you did, day by day: finished rounds and quiz chats. It only reads what the other features saved.

.only("field", ...) tells MongoEngine to load just those fields of each document, not the whole thing:
much faster when we only need, say, the dates."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from models.chat import ChatSession
from models.coding import CodingSession
from models.interview import Interview
from models.panel import PanelInterview
from models.question_bank import QuestionBank
from models.whiteboard import WhiteboardSession

# The kinds of round. Each one is "finished" once its report is written.
ROUNDS = {
    "interview": Interview,
    "coding": CodingSession,
    "whiteboard": WhiteboardSession,
    "panel": PanelInterview,
}

QUIZ_MESSAGES = 3  # a day counts as a quiz day once you send this many messages in the practice chat


def local_day(moment, minutes_ahead):
    """The calendar day of a saved time, in your time zone (minutes_ahead = how far ahead of UTC you are)."""
    if moment.tzinfo is not None:
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)  # Mongo gives back plain UTC times
    return (moment + timedelta(minutes=minutes_ahead)).date()


def local_today(minutes_ahead):
    """Today's date in your time zone."""
    return local_day(datetime.now(timezone.utc), minutes_ahead)


def quiz_days(minutes_ahead):
    """The days on which you sent at least QUIZ_MESSAGES messages in the practice chat."""
    sent = Counter()
    for chat in ChatSession.objects.only("messages"):
        for message in chat.messages:
            if message.role == "user":
                sent[local_day(message.created_at, minutes_ahead)] += 1
    days = set()
    for day, count in sent.items():
        if count >= QUIZ_MESSAGES:
            days.add(day)
    return days


def bank_days(minutes_ahead):
    """The days on which you made a question bank."""
    days = set()
    for bank in QuestionBank.objects.only("created_at"):
        days.add(local_day(bank.created_at, minutes_ahead))
    return days


def activity_by_day(minutes_ahead, quizzes):
    """{day: how many things you did that day}. Each finished round counts 1, and a quiz day counts 1."""
    days = Counter()
    for model in ROUNDS.values():
        for session in model.objects(status="finished").only("updated_at"):
            days[local_day(session.updated_at, minutes_ahead)] += 1
    for day in quizzes:
        days[day] += 1
    return days


def round_totals():
    """For each kind of round: how many you finished, and your average and best score out of 5."""
    totals = {}
    for kind, model in ROUNDS.items():
        finished = list(model.objects(status="finished").only("overall"))
        scores = []
        for session in finished:
            if session.overall is not None:
                scores.append(session.overall)
        average = None
        best = None
        if scores:
            average = round(sum(scores) / len(scores), 1)
            best = max(scores)
        totals[kind] = {"finished": len(finished), "average": average, "best": best}
    return totals
