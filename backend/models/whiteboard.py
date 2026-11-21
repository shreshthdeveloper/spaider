from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, FloatField, ListField, StringField

from models.chat import utc_now


class WhiteboardSession(Document):
    """One system design round: the question, your drawing, what the interviewer said, and the report."""

    meta = {"collection": "whiteboard_sessions"}

    question = StringField(required=True)
    brief = StringField(default="")  # what the design must handle, shown under the question
    status = StringField(choices=["drawing", "finished"], default="drawing")
    scene = DictField()  # the latest drawing, as Excalidraw saves it: {"elements": [...]}
    messages = ListField(DictField())  # {"role": "interviewer" | "candidate", "text", "at"}
    report = DictField()  # filled in at the end
    overall = FloatField()  # the final score out of 5
    final_image = StringField()  # a PNG of the board when it was finished (data URL), for the report
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_whiteboard(session_id):
    """Return the session with this id, or None if there isn't one."""
    if not ObjectId.is_valid(session_id):
        return None
    return WhiteboardSession.objects(id=session_id).first()
