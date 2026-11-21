"""What the document routes call: upload a PDF, list documents, delete one."""
from pathlib import Path

from pypdf.errors import PdfReadError

from models.document import UploadedDocument
from services.rag import vector_store
from services.rag.chunks import split_pages
from services.rag.pdf import read_pdf
from services.rag.answer import answer_live, answer_question
from services.rag.vector_map import document_map


UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"  # backend/uploads (ignored by git)


class DocumentError(Exception):
    """A problem with the uploaded file itself, shown to the user as it is."""


def upload_document(file):
    """Saves the PDF, reads its pages, splits them into chunks and stores their vectors. If any step fails,
    nothing is kept."""
    document = UploadedDocument(filename=file.filename)
    document.save()
    document_id = str(document.id)

    UPLOAD_DIR.mkdir(exist_ok=True)
    path = UPLOAD_DIR / f"{document_id}.pdf"
    file.save(path)

    try:
        pages, page_count = _read(path)
        chunks = split_pages(pages, document_id)
        vector_store.add_chunks(chunks)  # embeds every chunk and stores the vectors in Chroma
    except Exception:
        delete_document(document)  # don't keep a half-indexed document
        raise

    document.pages = page_count
    document.chunks = len(chunks)
    document.save()
    return _summary(document)


def _read(path):
    """The pages of the PDF, or a DocumentError the user can understand."""
    try:
        pages, page_count = read_pdf(path)
    except PdfReadError:
        raise DocumentError("This file could not be read as a PDF.")
    if not pages:
        raise DocumentError("This PDF has no readable text. Scanned PDFs (pictures of pages) are not supported yet.")
    return pages, page_count


def list_documents():
    """Every document, newest first."""
    documents = []
    for document in UploadedDocument.objects.order_by("-created_at"):
        documents.append(_summary(document))
    return documents


def get_document(document):
    """One document's summary."""
    return _summary(document)


def ask_document(document, question):
    """An answer from this document only (see services/rag/answer.py)."""
    return answer_question(str(document.id), question)


def ask_document_live(document, question):
    """The same answer, word by word, as a stream of events (see services/rag/answer.py, answer_live)."""
    return answer_live(str(document.id), question)


def get_document_map(document):
    """Every chunk of the document as a point in 3D, for the "Under the hood" panel."""
    return document_map(str(document.id))


def delete_document(document):
    """Removes the document's chunks from Chroma, its PDF file, and its record."""
    document_id = str(document.id)
    vector_store.delete_chunks(document_id)
    path = UPLOAD_DIR / f"{document_id}.pdf"
    if path.exists():
        path.unlink()
    document.delete()


def _summary(document):
    """What the browser gets for a document."""
    return {
        "id": str(document.id),
        "filename": document.filename,
        "pages": document.pages,
        "chunks": document.chunks,
        "created_at": document.created_at.isoformat(),
    }
