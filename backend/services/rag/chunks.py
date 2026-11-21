from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 800      # characters per chunk: small enough to be precise, big enough to keep context
CHUNK_OVERLAP = 120   # characters shared by neighbouring chunks, so a sentence is not cut in half


def split_pages(pages, document_id):
    """Cut each page into chunks. Every chunk remembers its document and page, for citations later."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = []
    for page_number, text in pages:
        for piece in splitter.split_text(text):
            chunks.append(Document(page_content=piece, metadata={"document_id": document_id, "page": page_number}))
    return chunks
