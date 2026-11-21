import unicodedata

from pypdf import PdfReader


def read_pdf(path):
    """Return (pages, page_count). pages is [(page_number, text), ...] for every page that has text.

    Page numbers start at 1, like in a PDF viewer.
    """
    reader = PdfReader(path)
    pages = []
    for number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        # PDFs often store "fi", "fl"... as one special character. NFKC turns it back into normal letters.
        text = unicodedata.normalize("NFKC", text).strip()
        if text:
            pages.append((number, text))
    return pages, len(reader.pages)
