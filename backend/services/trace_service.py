"""What the trace routes call: the latest LLM calls, and one call in full."""
import math

from models.trace import LLMTrace


def list_traces(page=1, per_page=20, label=""):
    """One page of AI calls, newest first, and how many there are in total.

    label: show only one kind of call (e.g. "coding_review"); empty = all of them.
    """
    if label:
        calls = LLMTrace.objects(label=label)
    else:
        calls = LLMTrace.objects
    total = calls.count()

    pages = math.ceil(total / per_page)  # e.g. 41 calls, 20 per page -> 3 pages
    pages = max(pages, 1)  # no calls is still one (empty) page
    page = max(page, 1)  # a page number outside 1..pages moves to the nearest real page
    page = min(page, pages)

    traces = []
    for trace in calls.order_by("-created_at").skip((page - 1) * per_page).limit(per_page):
        traces.append(_summary(trace))
    return {
        "traces": traces,
        "total": total,
        "page": page,
        "pages": pages,
        "labels": _all_labels(),
    }


def _all_labels():
    """Every kind of call there is, A to Z, for the filter on the page."""
    labels = []
    for label in LLMTrace.objects.distinct("label"):
        if label:
            labels.append(label)
    return sorted(labels)


def get_trace(trace):
    """One AI call in full: the summary, plus the exact prompt, the answer and the tokens."""
    details = _summary(trace)
    details["prompt"] = trace.prompt
    details["output"] = trace.output
    details["tokens"] = trace.tokens
    return details


def _summary(trace):
    """What the traces table shows for one call."""
    return {
        "id": str(trace.id),
        "label": trace.label,
        "model": trace.model,
        "thread_id": trace.thread_id,
        "total_tokens": (trace.tokens or {}).get("total_tokens"),
        "duration_ms": trace.duration_ms,
        "error": trace.error,
        "created_at": trace.created_at.isoformat(),
    }
