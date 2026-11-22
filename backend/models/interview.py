from bson import ObjectId
from mongoengine import DateTimeField, Document, FloatField, IntField, StringField

from models.chat import utc_now


class Interview(Document):
    """One mock interview: its settings and final score.

    The questions, answers and grades are not here: LangGraph saves the interview's full state after
    every step (a "checkpoint") in its own collection, under thread_id = this interview's id."""

    meta = {"collection": "interviews"}

    topic = StringField(required=True)
    num_questions = IntField(required=True, min_value=1, max_value=20)
    difficulty = StringField(choices=["easy", "medium", "hard", "mixed"], default="mixed")
    max_follow_ups = IntField(min_value=0, max_value=2, default=1)  # follow-ups allowed per question
    mode = StringField(choices=["text", "voice"], default="text")  # voice = the interviewer speaks
    source = StringField(default="")             # where it came from: "resume" = a Resume grind, "" = a topic
    status = StringField(required=True, choices=["in_progress", "finished"], default="in_progress")
    overall = FloatField()                       # the final score, set when the interview finishes
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_interview(interview_id):
    """Return the interview with this id, or None if there isn't one."""
    if not ObjectId.is_valid(interview_id):
        return None
    return Interview.objects(id=interview_id).first()
