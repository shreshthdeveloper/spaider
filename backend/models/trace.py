from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, IntField, ListField, StringField

from models.chat import utc_now

KEEP_DAYS = 7  # MongoDB deletes traces older than this by itself (the "expireAfterSeconds" rule below)


class LLMTrace(Document):
    """One call to the LLM: what it was asked, what it answered, and how long it took."""

    meta = {
        "collection": "llm_traces",
        "indexes": [{"fields": ["created_at"], "expireAfterSeconds": KEEP_DAYS * 24 * 3600}],
    }

    label = StringField()            # which step made the call: "chat", "grade", "document_answer"...
    model = StringField()
    thread_id = StringField()        # the interview id, for calls made inside an interview
    prompt = ListField(DictField())  # [{"role": "system" | "human" | "ai", "content": "..."}]
    output = StringField()
    tokens = DictField()
    duration_ms = IntField()
    error = StringField()
    created_at = DateTimeField(default=utc_now)


def find_trace(trace_id):
    """Return the trace with this id, or None if there isn't one."""
    if not ObjectId.is_valid(trace_id):
        return None
    return LLMTrace.objects(id=trace_id).first()
