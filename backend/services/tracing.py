"""Our own trace log: every LLM call is saved to MongoDB, so a bad answer can be explained later.

LangChain calls these methods by itself whenever a chat model starts, finishes or fails.
The logger is attached once, where the model is created (services/llm.py).
"""
import json
import logging
import time

from langchain_core.callbacks import BaseCallbackHandler

from models.trace import LLMTrace

log = logging.getLogger(__name__)


class TraceLogger(BaseCallbackHandler):
    """LangChain calls on_chat_model_start when a model call begins, and on_llm_end or on_llm_error when
    it ends. Each call has its own run_id, so we can match the end to its start.
    (The method names and arguments are fixed by LangChain; the * means "the rest must be passed by name".)"""

    def __init__(self):
        """Starts with no calls in progress."""
        self._running = {}  # run_id -> details of a call that has started but not finished yet

    def on_chat_model_start(self, serialized, messages, *, run_id, metadata=None, **kwargs):
        """A model call began: remember its prompt, label and start time until it ends."""
        metadata = metadata or {}
        params = kwargs.get("invocation_params") or {}  # the settings the call was made with

        prompt = []
        for message in messages[0]:
            prompt.append({"role": message.type, "content": _text(message.content)})

        self._running[run_id] = {
            "started": time.perf_counter(),
            "label": _label(metadata, kwargs),
            "model": _model_name(params),
            "thread_id": metadata.get("thread_id"),
            "prompt": prompt,
        }

    def on_llm_end(self, response, *, run_id, **kwargs):
        """A model call ended: save it with its answer and its tokens."""
        message = response.generations[0][0].message
        self._save(run_id, output=_output(message), tokens=message.usage_metadata or {})

    def on_llm_error(self, error, *, run_id, **kwargs):
        """A model call failed: save it with the error."""
        self._save(run_id, error=f"{type(error).__name__}: {error}")

    def _save(self, run_id, output="", tokens=None, error=None):
        """Writes one finished call to MongoDB (the llm_traces collection)."""
        call = self._running.pop(run_id, None)
        if call is None:
            return
        try:
            LLMTrace(
                label=call["label"],
                model=call["model"],
                thread_id=call["thread_id"],
                prompt=call["prompt"],
                output=output,
                tokens=tokens or {},
                duration_ms=round((time.perf_counter() - call["started"]) * 1000),
                error=error,
            ).save()
        except Exception:
            # Tracing must never break the app: if saving fails, log it and carry on.
            log.exception("could not save an LLM trace")


def _label(metadata, kwargs):
    """Which step made the call, for the AI traces page."""
    # 1. the name we gave it ourselves: config={"metadata": {"step": "grade"}}
    #    (metadata reaches the model even through with_structured_output)
    if metadata.get("step"):
        return metadata["step"]
    # 2. else the LangGraph step (node) it ran inside
    if metadata.get("langgraph_node"):
        return metadata["langgraph_node"]
    # 3. else whatever name LangChain gave it
    if kwargs.get("name"):
        return kwargs["name"]
    return "llm"


def _model_name(params):
    """Different providers put the model's name under different keys."""
    if params.get("model"):
        return params["model"]
    if params.get("model_name"):
        return params["model_name"]
    return ""


def _text(content):
    """Message content is usually a string, but can be a list of parts (text and pictures)."""
    if isinstance(content, str):
        return content
    parts = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "image_url":
            parts.append("[picture]")  # a picture is far too big to keep in a trace
        elif isinstance(part, dict) and part.get("type") == "text":
            parts.append(part["text"])
        else:
            parts.append(json.dumps(part))
    return "\n\n".join(parts)


def _output(message):
    """Structured-output calls can answer through a tool call instead of plain text."""
    if message.content:
        return _text(message.content)
    if message.tool_calls:
        return json.dumps(message.tool_calls[0]["args"], indent=2)
    return ""
