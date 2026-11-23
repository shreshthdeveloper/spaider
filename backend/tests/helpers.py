"""Small helpers for the tests."""
import json


def read_events(response):
    """The messages of a live stream (Server-Sent Events) as [(name, data)]."""
    events = []
    for block in response.get_data(as_text=True).strip().split("\n\n"):
        name = None
        data = None
        for line in block.split("\n"):
            if line.startswith("event: "):
                name = line[len("event: "):]
            if line.startswith("data: "):
                data = json.loads(line[len("data: "):])
        events.append((name, data))
    return events


def answer_live(client, path, text):
    """Sends an answer to a live route and returns (all the events, the final "done" data)."""
    events = read_events(client.post(path, json={"answer": text}))
    return events, events[-1][1]
