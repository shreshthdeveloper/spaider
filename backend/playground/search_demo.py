"""See semantic search on an uploaded document. From backend/:

    python -m playground.search_demo <document_id> "your question"
"""
import sys

from dotenv import load_dotenv

from services.rag.vector_store import search

load_dotenv()

document_id = sys.argv[1]
question = sys.argv[2]

for chunk, score in search(document_id, question, k=3):
    text = chunk.page_content[:160].replace("\n", " ")
    print(f"page {chunk.metadata['page']}   relevance {score:.2f}")
    print(f"    {text}...\n")
