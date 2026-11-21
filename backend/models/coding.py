from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, FloatField, IntField, ListField, StringField

from models.chat import utc_now


class CodingSession(Document):
    """One coding round: the problem, your code, what Bella said, and the report."""

    meta = {"collection": "coding_sessions"}

    problem_id = StringField(required=True)  # see services/coding/problems.py
    mode = StringField(choices=["interview", "practice"], default="interview")
    status = StringField(choices=["coding", "finished"], default="coding")
    code = StringField(default="")
    messages = ListField(DictField())  # {"role": "interviewer" | "candidate", "text", "at"}
    hints_used = IntField(default=0)
    report = DictField()
    overall = FloatField()  # the final score out of 5
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_coding(session_id):
    """Return the session with this id, or None if there isn't one."""
    if not ObjectId.is_valid(session_id):
        return None
    return CodingSession.objects(id=session_id).first()
