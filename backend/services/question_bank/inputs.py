"""What the candidate gave us: reading their PDFs, writing it all out for the prompts, and checking
the agents' "based on" quotes against it."""
from pypdf.errors import PdfReadError

from services.rag.pdf import read_pdf
from services.text import simplify

MAX_TEXT = 6000  # characters of the job description, and of the resume, that the agents read


class InputError(Exception):
    """A problem with what the candidate uploaded, shown to them as it is."""


def pdf_text(file):
    """The text of an uploaded PDF (a Flask file)."""
    try:
        pages, _ = read_pdf(file.stream)
    except PdfReadError:
        raise InputError(f"{file.filename} could not be read as a PDF.")
    page_texts = []
    for _, page_text in pages:  # each page is (page number, text)
        page_texts.append(page_text)
    text = "\n".join(page_texts)
    if not text:
        raise InputError(f"{file.filename} has no readable text. Scanned PDFs are not supported.")
    return text


def describe(inputs):
    """Everything the candidate gave us, as one block of text for the prompts."""
    return "\n".join([
        f"Company: {inputs.get('company') or 'not given'}",
        f"Position: {inputs.get('position') or 'not given'}",
        f"Interview type: {inputs['interview_type']}",
        f"Level: {inputs['level']}",
        f"Topics: {inputs.get('topics') or 'none'}",
        f"Documents the agents can search: {_document_names(inputs)}",
        "",
        "Job description:",
        inputs.get("jd", "")[:MAX_TEXT] or "(not given)",
        "",
        "Resume:",
        inputs.get("resume", "")[:MAX_TEXT] or "(not given)",
    ])


def _document_names(inputs):
    """The names of the documents the agents may search, for the prompt."""
    names = []
    for document in inputs.get("documents", []):
        names.append(document["filename"])
    return ", ".join(names) or "none"


def source_of(quote, inputs, passages=()):
    """Where an agent's quote really comes from, as (source, detail): ("jd" | "resume" | "topics", ""), or
    ("docs", "notes.pdf, page 4") for a passage it found. ("", "") if the words are in none of them,
    so a question is only marked "from your JD" when the words are really there."""
    quote = simplify(quote)
    if len(quote) < 4:
        return "", ""
    for key in ("jd", "resume", "topics"):
        if quote in simplify(inputs.get(key, "")):
            return key, ""
    for passage in passages:
        if quote in simplify(passage["text"]):
            return "docs", f"{passage['doc']}, page {passage['page']}"
    return "", ""
