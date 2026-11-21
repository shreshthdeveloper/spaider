from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, IntField, ListField, StringField

from models.chat import utc_now


class EvalRun(Document):
    """One run of an eval suite: its scores, and the result for every case."""

    meta = {"collection": "eval_runs"}

    suite = StringField(required=True)  # see evals/suites.py
    status = StringField(choices=["running", "done", "failed"], default="running")
    model = StringField(default="")  # the AI model that was tested
    prompt_version = StringField(default="")  # a fingerprint of the prompt that was tested
    metrics = DictField()  # e.g. {"point_accuracy": 0.9, "precision": 0.95, ...}
    cases = ListField(DictField())  # one result per case: what you expected, what the AI did
    error = StringField(default="")
    duration_ms = IntField()
    created_at = DateTimeField(default=utc_now)


def find_eval_run(run_id):
    """Return the run with this id, or None if there isn't one."""
    if not ObjectId.is_valid(run_id):
        return None
    return EvalRun.objects(id=run_id).first()
