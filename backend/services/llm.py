"""The AI models the app uses: one chat model and one embedding model.

@lru_cache means "make it the first time it is asked for, then hand out that same one every time after",
so the app creates each model once instead of on every request.

You will often see get_model().with_structured_output(SomeClass): it makes the model answer in the
shape of that class (filled-in fields, checked by Pydantic) instead of free text, so the code can read
the answer safely, e.g. grade.checks[0].covered."""
import os
from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain.embeddings import init_embeddings

from services.tracing import TraceLogger


@lru_cache
def get_model():
    """The chat model (MODEL in .env). TraceLogger saves every call it makes (see services/tracing.py)."""
    return init_chat_model(os.getenv("MODEL", "openai:gpt-6-luna"), callbacks=[TraceLogger()])


@lru_cache
def get_embeddings():
    """The model that turns text into vectors (lists of numbers) for semantic search."""
    return init_embeddings(os.getenv("EMBEDDING_MODEL", "openai:text-embedding-3-small"))
