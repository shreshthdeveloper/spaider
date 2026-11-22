from mongoengine import DateTimeField, DictField, Document, IntField, ListField, StringField

from models.chat import utc_now


class Resume(Document):
    """Your resume for the Resume grind: its text, every claim in it, and how well you defend each one.

    There is one resume at a time. Uploading a new version updates this same resume, and claims that did not
    change keep their scores (see services/resume_grind/claims.py)."""

    meta = {"collection": "resumes"}

    filename = StringField(default="")
    text = StringField(required=True)  # the resume's text, with contact details removed
    lines = ListField(StringField())  # the same text, one line each, as the page shows it
    removed_details = IntField(default=0)  # how many emails, phone numbers and links were taken out
    version = IntField(default=1)  # 1, then 2 after you upload a new version, and so on
    claims = ListField(DictField())  # one dict per claim: see "A claim" below
    changes = DictField()  # this version against the one before: {"new", "changed", "removed"}
    grinds = ListField(DictField())  # every grind started: {"interview_id", "claim_ids", "saved", "at"}
    last_grind = DictField()  # how the last finished grind went: {"asked", "better", "same", "worse", "first", "at"}
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


# A claim (one dict in Resume.claims):
#   id                a short id that stays the same across versions of the resume
#   quote             the claim, word for word from the resume
#   line, line_count  where it is: its first line and how many lines it covers (None and 0 if not found)
#   kind              "number", "tech", "lead" or "project"
#   likely_questions  2 questions an interviewer would probably ask about it
#   status            "new" or "changed" (since the version before) until it is asked, then "same"
#   before            the old wording, when it changed
#   score             the last grind's score out of 5, or None if never asked
#   level             "untested", "red", "yellow" or "green"
#   due               the day it should be asked again, like "2026-11-23" ("" = today)
#   attempts          every time it was asked: {"at", "question", "answer", "score", "feedback", "missed", "follow_ups"}


def current_resume():
    """The resume, or None if none was uploaded yet."""
    return Resume.objects.order_by("-created_at").first()
