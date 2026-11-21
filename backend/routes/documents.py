from flask import Blueprint, jsonify, request

from models.document import find_document
from services import document_service
from services.document_service import DocumentError
from services.sse import sse_response

documents_bp = Blueprint("documents", __name__)


MAX_QUESTION_LENGTH = 1000


@documents_bp.post("/documents")
def upload_document():
    """POST /api/documents (a form with a PDF in "file"): reads, splits and indexes the PDF so you can ask
    about it."""
    file = request.files.get("file")
    if file is None or file.filename == "":
        return jsonify(error="choose a PDF file to upload"), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify(error="only PDF files are supported"), 400

    # Don't trust the file name: a real PDF always starts with "%PDF-".
    first_bytes = file.stream.read(5)
    file.stream.seek(0)
    if first_bytes != b"%PDF-":
        return jsonify(error="this file is not a real PDF"), 400

    try:
        return jsonify(document_service.upload_document(file)), 201
    except DocumentError as error:
        return jsonify(error=str(error)), 422


@documents_bp.get("/documents")
def list_documents():
    """GET /api/documents: every uploaded document, newest first."""
    return jsonify(documents=document_service.list_documents())


@documents_bp.get("/documents/<document_id>")
def get_document(document_id):
    """GET /api/documents/<id>: one document's name, page count and chunk count."""
    document = find_document(document_id)
    if document is None:
        return jsonify(error="document not found"), 404
    return jsonify(document_service.get_document(document))


@documents_bp.get("/documents/<document_id>/map")
def document_map(document_id):
    """GET /api/documents/<id>/map: every chunk as a point in 3D, for the Under the hood panel."""
    document = find_document(document_id)
    if document is None:
        return jsonify(error="document not found"), 404
    return jsonify(document_service.get_document_map(document))


def _read_question(document_id):
    """Returns (document, question, None) when the question can be answered, or (None, None, error response)."""
    document = find_document(document_id)
    if document is None:
        return None, None, (jsonify(error="document not found"), 404)

    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return None, None, (jsonify(error="question is required"), 400)
    if len(question) > MAX_QUESTION_LENGTH:
        return None, None, (jsonify(error=f"question is too long (max {MAX_QUESTION_LENGTH} characters)"), 400)
    return document, question, None


@documents_bp.post("/documents/<document_id>/ask")
def ask_document(document_id):
    """POST /api/documents/<id>/ask  {question}: an answer from this document only, with page numbers."""
    document, question, error = _read_question(document_id)
    if error:
        return error
    return jsonify(document_service.ask_document(document, question))


@documents_bp.post("/documents/<document_id>/ask/live")
def ask_document_live(document_id):
    """POST /api/documents/<id>/ask/live  {question}: the same answer, word by word (Server-Sent Events):
    "retrieved" when the search is done, "token" for every few words, then "done" with the sources."""
    document, question, error = _read_question(document_id)
    if error:
        return error
    return sse_response(document_service.ask_document_live(document, question))


@documents_bp.delete("/documents/<document_id>")
def delete_document(document_id):
    """DELETE /api/documents/<id>: removes the document, its chunks and its file."""
    document = find_document(document_id)
    if document is None:
        return jsonify(error="document not found"), 404
    document_service.delete_document(document)
    return jsonify(deleted=True)


@documents_bp.app_errorhandler(413)
def file_too_large(error):
    """Flask sends a 413 error when an upload is bigger than MAX_CONTENT_LENGTH (app.py). This turns it into
    a message the page can show."""
    return jsonify(error="the file is too large (max 10 MB)"), 413
