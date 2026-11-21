from bson import ObjectId
from mongoengine import BooleanField, DateTimeField, DictField, Document, IntField, ListField, StringField

from models.chat import utc_now


class QuestionBank(Document):
    """Questions an agent panel wrote for one candidate, and how the panel got there."""

    meta = {"collection": "question_banks"}

    title = StringField(required=True)  # e.g. "Backend Engineer at Damco"
    inputs = DictField()  # company, position, interview_type, level, topics, jd, resume, documents
    agent_ids = ListField(StringField())  # the agents that ran (see services/question_bank/agents.py)
    review = BooleanField(default=False)  # review mode: the panel pauses for your approval (human in the loop)
    runs = IntField(default=0)  # how many times the panel ran; each run is its own LangGraph thread
    status = StringField(choices=["running", "needs_you", "done", "failed"], default="running")
    pending = DictField()  # while status is "needs_you": what the panel is asking you
    error = StringField(default="")
    steps = ListField(DictField())  # the pipeline as the browser draws it: who is waiting, thinking, done
    plan = StringField(default="")  # the panel lead's plan
    summary = StringField(default="")  # the judge's verdict on the bank
    questions = ListField(DictField())  # the questions the judge kept
    dropped = ListField(DictField())  # the ones it removed, with the reason
    practised = ListField(DictField())  # rounds started from this bank: {"question_ids", "page", "at"}
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_bank(bank_id):
    """Return the bank with this id, or None if there isn't one."""
    if not ObjectId.is_valid(bank_id):
        return None
    return QuestionBank.objects(id=bank_id).first()
