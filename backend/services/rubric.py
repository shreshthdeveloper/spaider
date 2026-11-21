"""Scoring a round against a rubric ("no proof, no points"). Used by the coding and whiteboard reports.

The AI judges each rubric area: a level (missing / basic / good / strong) and a quote as evidence.
The code then checks that the quote really appears in what the candidate wrote or said. Without a
real quote the area counts as missing, and the points come from the level, never from a number the
AI picks.
"""
from services.text import simplify

POINTS = {"missing": 0, "basic": 2, "good": 4, "strong": 5}


def rubric_text(rubric):
    """The rubric as lines for the prompt:  "- Approach: explains a plan before coding" """
    lines = []
    for area, looks_for in rubric:
        lines.append(f"- {area}: {looks_for}")
    return "\n".join(lines)


def candidate_words(messages):
    """Everything the candidate said in the round, as one text. (Bella's own words never count as proof.)"""
    said = []
    for message in messages:
        if message["role"] == "candidate":
            said.append(message["text"])
    return " ".join(said)


def score_areas(rubric, checks, code="", words=""):
    """One result per rubric area, in the rubric's order.

    checks  the AI's judgement: a list of {area, level, evidence, comment}
    code    where a quote must appear exactly (only spaces and line breaks may differ)
    words   where a quote may appear loosely (punctuation and capitals may differ)
    """
    checks_by_area = {}
    for check in checks:
        checks_by_area[check.area.strip().lower()] = check

    areas = []
    for area, looks_for in rubric:
        check = checks_by_area.get(area.lower())
        areas.append(_score_area(area, looks_for, check, code, words))
    return areas


def _score_area(area, looks_for, check, code, words):
    """One area's result: the AI's level only if its quote is real; otherwise missing, with the quote shown
    as unproven."""
    result = {
        "area": area,
        "looks_for": looks_for,
        "level": "missing",
        "points": 0,
        "evidence": "",  # the quote, when it is real
        "unproven_claim": "",  # the quote, when it is NOT really there (shown to the candidate)
        "comment": "Not covered.",
    }
    if check is None:  # the AI said nothing about this area
        return result

    result["comment"] = check.comment
    evidence = check.evidence.strip()
    if is_proven(evidence, code, words):
        result["level"] = check.level
        result["points"] = POINTS[check.level]
        result["evidence"] = evidence
    elif evidence:
        result["unproven_claim"] = evidence
    return result


def is_proven(quote, code="", words=""):
    """True if the quote really appears in the code, or in the words."""
    if not quote:
        return False
    if code and _in_code(quote, code):
        return True
    if words and _in_words(quote, words):
        return True
    return False


def _in_code(quote, code):
    """Exact match; only spaces and line breaks may differ."""
    quote = " ".join(quote.split())
    return quote != "" and quote in " ".join(code.split())


def _in_words(quote, words):
    """Loose match: punctuation and capitals don't matter."""
    quote = simplify(quote)
    return quote != "" and quote in simplify(words)


def average_points(areas):
    """The average points over all the areas."""
    total = 0
    for area in areas:
        total += area["points"]
    return total / len(areas)
