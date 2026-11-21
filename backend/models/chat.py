from datetime import datetime, timezone

from bson import ObjectId
from mongoengine import DateTimeField, DictField, Document, EmbeddedDocument, EmbeddedDocumentListField, StringField


def utc_now():
    """The time now, in UTC: one clock for everything we save. The browser shows it in your own time zone."""
    return datetime.now(timezone.utc)


class Message(EmbeddedDocument):
    """One message inside a chat. "Embedded" means it is saved inside its ChatSession, not on its own."""

    role = StringField(required=True, choices=["user", "ai"])
    content = StringField(required=True)
    tokens = DictField()
    created_at = DateTimeField(default=utc_now)


class ChatSession(Document):
    """One chat. Its messages are stored inside it."""

    meta = {"collection": "chat_sessions"}

    messages = EmbeddedDocumentListField(Message)
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)


def find_chat(chat_id):
    """Return the chat with this id, or None if there isn't one."""
    if not ObjectId.is_valid(chat_id):
        return None
    return ChatSession.objects(id=chat_id).first()
