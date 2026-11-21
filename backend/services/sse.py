"""Server-Sent Events (SSE): one HTTP response that stays open while the server sends small messages.

Normally a request gets one answer, all at the end. With SSE the server keeps the response open and
writes a message whenever it has news. Each message is plain text, and ends with an empty line:

    event: finish
    data: {"node": "grade"}

The browser reads them one by one as they arrive (frontend/src/lib/sse.js).
It is one-way (server -> browser), which is all we need here; a WebSocket would be two-way.
"""
import json
import logging

from flask import Response

log = logging.getLogger(__name__)


def sse_response(events):
    """A streaming HTTP response from a generator of (event name, data) pairs."""
    headers = {
        "Cache-Control": "no-cache",  # never keep a copy of a live stream
        "X-Accel-Buffering": "no",  # tells proxies like nginx to pass each message on at once
    }
    return Response(_stream(events), mimetype="text/event-stream", headers=headers)


def _stream(events):
    """Turns each (name, data) into an SSE message, as the generator produces them.

    The status code (200) is sent before the first message, so an error in the middle can't change it:
    it is sent as an "error" message instead, and the page shows it."""
    try:
        for name, data in events:
            yield _message(name, data)
    except Exception as error:
        log.exception("a live stream failed")
        yield _message("error", {"error": f"{type(error).__name__}: {error}"})


def _message(name, data):
    """One SSE message: the event's name, its data as JSON, then an empty line."""
    return f"event: {name}\ndata: {json.dumps(data)}\n\n"
