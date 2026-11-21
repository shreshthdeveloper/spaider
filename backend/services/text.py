"""Small text helpers used in several places."""


def simplify(text):
    """Lower case, letters and digits only (everything else becomes a space), so punctuation and spacing
    don't matter when we look for a quote:  "Hash-map, O(n)!"  ->  "hash map o n"  """
    kept = ""
    for char in text.lower():
        if char.isalnum():
            kept += char
        else:
            kept += " "
    return " ".join(kept.split())


def conversation_text(messages, last=12):
    """The latest messages of a whiteboard or coding round as plain lines, for a prompt:
    "Interviewer: ..." and "Candidate: ..." """
    lines = []
    for message in messages[-last:]:
        if message["role"] == "interviewer":
            who = "Interviewer"
        else:
            who = "Candidate"
        lines.append(f"{who}: {message['text']}")
    if not lines:
        return "(nothing yet)"
    return "\n".join(lines)
