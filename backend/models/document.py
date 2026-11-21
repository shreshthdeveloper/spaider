from bson import ObjectId
from mongoengine import DateTimeField, Document, IntField, StringField

from models.chat import utc_now


class UploadedDocument(Document):
    """One uploaded PDF. Its text chunks and their vectors live in Chroma, tagged with this id."""

    meta = {"collection": "documents"}

    filename = StringField(required=True)
    pages = IntField(default=0)
    chunks = IntField(default=0)
    created_at = DateTimeField(default=utc_now)


def find_document(document_id):
    """Return the document with this id, or None if there isn't one."""
    if not ObjectId.is_valid(document_id):
        return None
    return UploadedDocument.objects(id=document_id).first()
