"""Finding the claims in a resume, and matching them with the version before."""
import uuid
from difflib import SequenceMatcher

from langchain_core.messages import HumanMessage, SystemMessage

from services.llm import get_model
from services.resume_grind.prompts import FIND_CLAIMS_PROMPT
from services.resume_grind.schemas import FoundClaims
from services.text import simplify

MAX_CLAIMS = 25
MIN_QUOTE = 8  # letters and digits: shorter quotes are too vague to test
MAX_LINES_PER_CLAIM = 3  # a long bullet point can wrap onto the next lines
SAME_ENOUGH = 0.6  # how alike two wordings must be (0 to 1) to count as one claim that changed


def find_claims(text, lines):
    """Asks the AI for the claims in the resume. Keeps only those whose words really are in the resume (the
    AI must copy, not reword), and notes which lines each one is on."""
    finder = get_model().with_structured_output(FoundClaims)
    answer = finder.invoke([
        SystemMessage(FIND_CLAIMS_PROMPT.format(max_claims=MAX_CLAIMS)),
        HumanMessage(f"<resume>\n{text}\n</resume>"),
    ])

    resume_words = simplify(text)
    seen = []
    claims = []
    for found in answer.claims[:MAX_CLAIMS]:
        words = simplify(found.quote)
        if len(words) < MIN_QUOTE or words in seen or words not in resume_words:
            continue  # too short, a repeat, or not really in the resume
        seen.append(words)
        line, line_count = find_lines(found.quote, lines)
        claims.append({
            "id": uuid.uuid4().hex[:10],
            "quote": found.quote.strip(),
            "line": line,
            "line_count": line_count,
            "kind": found.kind,
            "likely_questions": found.likely_questions[:2],
            "status": "new",
            "before": "",
            "score": None,
            "level": "untested",
            "due": "",
            "attempts": [],
        })
    return claims


def find_lines(quote, lines):
    """Where the quote is in the resume: (its first line, how many lines), or (None, 0) if not found.
    One line is tried first, then two lines together, then three."""
    wanted = simplify(quote)
    for count in range(1, MAX_LINES_PER_CLAIM + 1):
        for start in range(len(lines) - count + 1):
            together = simplify(" ".join(lines[start:start + count]))
            if wanted in together:
                return start, count
    return None, 0


def match_with_before(old_claims, new_claims):
    """Matches each claim of the new version with the old claim it came from, so your progress carries over:
      the same words  -> "same": keeps its id, score, colour, next day and answers
      similar words   -> "changed": keeps its id, score and answers, but is asked again today
      no match        -> stays "new"
    Returns the old claims that are gone."""
    unmatched = list(old_claims)
    for claim in new_claims:
        old = _same_words(claim, unmatched)
        if old is not None:
            claim["status"] = "same"
            claim["due"] = old["due"]
        else:
            old = _closest(claim, unmatched)
            if old is None:
                continue
            claim["status"] = "changed"
            claim["before"] = old["quote"]
            claim["due"] = ""  # asked again today
        unmatched.remove(old)
        claim["id"] = old["id"]
        claim["score"] = old["score"]
        claim["level"] = old["level"]
        claim["attempts"] = old["attempts"]
    return unmatched


def _same_words(claim, old_claims):
    """The old claim with exactly the same words (ignoring case and punctuation), or None."""
    words = simplify(claim["quote"])
    for old in old_claims:
        if simplify(old["quote"]) == words:
            return old
    return None


def _closest(claim, old_claims):
    """The old claim worded most like this one, if it is alike enough (SAME_ENOUGH), or None."""
    words = simplify(claim["quote"])
    best = None
    best_likeness = SAME_ENOUGH
    for old in old_claims:
        likeness = SequenceMatcher(None, simplify(old["quote"]), words).ratio()
        if likeness >= best_likeness:
            best = old
            best_likeness = likeness
    return best
