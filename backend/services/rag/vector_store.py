from functools import lru_cache
from pathlib import Path

from langchain_chroma import Chroma

from services.llm import get_embeddings

CHROMA_DIR = Path(__file__).resolve().parents[2] / "chroma"  # backend/chroma (ignored by git)


@lru_cache
def get_vector_store():
    """One Chroma collection holds the chunks of every document. Each chunk is tagged with its document_id."""
    return Chroma(
        collection_name="document_chunks",
        embedding_function=get_embeddings(),
        persist_directory=str(CHROMA_DIR),
        collection_metadata={"hnsw:space": "cosine"},  # compare vectors by angle (cosine similarity)
    )


def add_chunks(chunks):
    """Embeds every chunk (turns its text into a vector) and stores it in Chroma."""
    get_vector_store().add_documents(chunks)


def delete_chunks(document_id):
    """Removes every chunk of one document from Chroma."""
    get_vector_store().delete(where={"document_id": document_id})


def search(document_id, query, k=5):
    """The k chunks of one document closest in meaning to the query, each with a relevance score from 0 to 1.
    The k chunks of one document closest in meaning to the query, each with a relevance score from 0 to 1."""
    return get_vector_store().similarity_search_with_relevance_scores(query, k=k, filter={"document_id": document_id})


def embed_question(question):
    """The question as a vector, made by the same embedding model that made the chunk vectors."""
    return get_embeddings().embed_query(question)


def search_by_vector(document_id, query_vector, k=5):
    """Like search(), for a question that is already a vector (so the app can also show that vector).

    Chroma returns a cosine distance (0 = same meaning). The relevance score is 1 - distance,
    exactly what search() returns, so MIN_RELEVANCE means the same thing for both.
    """
    results = get_vector_store().similarity_search_by_vector_with_relevance_scores(
        query_vector, k=k, filter={"document_id": document_id}
    )
    scored = []
    for chunk, distance in results:
        scored.append((chunk, 1 - distance))  # distance 0 = same meaning, so score 1
    return scored


def get_document_vectors(document_id):
    """Every chunk of one document with its vector, page and text (for the 3D map)."""
    return get_vector_store().get(
        where={"document_id": document_id}, include=["embeddings", "metadatas", "documents"]
    )
