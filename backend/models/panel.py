from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, FloatField, IntField, ListField, StringField

from models.chat import utc_now


class PanelInterview(Document):
    """One panel interview: who sat on the panel, its settings and the result.

    The questions, answers, private notes and verdicts are not here: LangGraph saves the panel's full state
    after every step (a "checkpoint") in its own collection, under thread_id = this panel's id."""

    meta = {"collection": "panel_interviews"}

    title = StringField(required=True)  # e.g. "Backend Engineer at Damco"
    inputs = DictField()  # role, company, level, jd, resume, weak_lines
    panelist_ids = ListField(StringField())  # who sits on the panel (see services/panel/panelists.py)
    num_questions = IntField(min_value=2, max_value=12, default=6)  # main questions for the whole panel
    max_follow_ups = IntField(min_value=0, max_value=2, default=1)  # follow-ups allowed after each main question
    mode = StringField(choices=["text", "voice"], default="text")  # voice = a video call where the panelists speak
    status = StringField(choices=["in_progress", "finished"], default="in_progress")
    overall = FloatField()  # the final score, set when the panel finishes
    decision = StringField(default="")  # "Hire" or "No hire", set when the panel finishes
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_panel(panel_id):
    """Return the panel interview with this id, or None if there isn't one."""
    if not ObjectId.is_valid(panel_id):
        return None
    return PanelInterview.objects(id=panel_id).first()
