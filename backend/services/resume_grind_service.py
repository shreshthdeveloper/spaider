"""What the Resume grind routes call: upload a resume (or a new version), open it, start a grind, delete it.

A grind is a normal mock interview with Bella. Its questions come from your weakest claims
(resume_grind/questions.py), and when it finishes, each answer's score goes back to its claim
(resume_grind/schedule.py), so the claim changes colour and comes back sooner or later.
"""
from models.chat import utc_now
from models.interview import find_interview
from models.resume import Resume, current_resume
from services import interview_service
from services.resume_grind.claims import find_claims, match_with_before
from services.resume_grind.privacy import remove_contact_details
from services.resume_grind.questions import write_questions
from services.resume_grind.schedule import is_due, pick_for_grind, save_answer

MAX_TEXT = 20000  # characters of resume text we read


class ResumeError(Exception):
    """A problem with the resume, shown to the user as it is."""


def upload(text, filename):
    """A first resume, or a new version of the one you have. Contact details are taken out first, then the AI
    finds the claims. A new version keeps the progress of every claim that is still there."""
    clean_text, removed = remove_contact_details(text[:MAX_TEXT])
    lines = _lines(clean_text)
    claims = find_claims(clean_text, lines)
    if not claims:
        raise ResumeError("No claims were found in this resume. Is it a resume, with bullet points about your work?")

    resume = current_resume()
    if resume is None:
        resume = Resume(text=clean_text)
        changes = {}
    else:
        save_finished_grinds(resume)  # so the last grind's scores are on the old claims before they move over
        gone = match_with_before(resume.claims, claims)
        resume.version += 1
        changes = {"new": _count_status(claims, "new"), "changed": _count_status(claims, "changed"), "removed": _quotes(gone)}

    resume.filename = filename
    resume.text = clean_text
    resume.lines = lines
    resume.removed_details = removed
    resume.claims = claims
    resume.changes = changes
    resume.updated_at = utc_now()
    resume.save()
    return build_response(resume)


def open_resume(resume):
    """The resume as the page shows it, with the scores of any grind that finished since the last look."""
    save_finished_grinds(resume)
    return build_response(resume)


def start_grind(resume, count, mode):
    """Starts a mock interview about `count` claims (the weakest that are due). Returns the interview, so the
    page can open it."""
    save_finished_grinds(resume)
    claims = pick_for_grind(resume.claims, count)
    questions = write_questions(claims)
    view = interview_service.start_interview(
        f"Resume grind: {len(questions)} lines of your resume",
        len(questions),
        difficulty="hard",
        mode=mode,
        questions=questions,
        source="resume",
    )

    claim_ids = []
    for claim in claims:
        claim_ids.append(claim["id"])
    resume.grinds.append({"interview_id": view["id"], "claim_ids": claim_ids, "saved": False, "at": utc_now().isoformat()})
    resume.save()
    return view


def delete_resume(resume):
    """Deletes the resume and its claims. The grind interviews stay in Past interviews."""
    resume.delete()


def save_finished_grinds(resume):
    """Puts the scores of every grind that finished since the last look onto its claims. It runs whenever the
    resume is opened, so it works however the grind ended: the last answer, the End button, or Try again."""
    for grind in resume.grinds:
        if grind["saved"]:
            continue
        interview = find_interview(grind["interview_id"])
        if interview is not None and interview.status != "finished":
            continue  # still going
        if interview is not None:
            results = interview_service.build_response(interview)["results"]
            _score_claims(resume, grind["claim_ids"], results)
        grind["saved"] = True  # done (or the interview was deleted): never look at it again
        resume.save()


def _score_claims(resume, claim_ids, results):
    """The grind asked about the claims in order: the first main question was about the first claim, and so on.
    Each main answer, with its follow-ups, goes to its claim. Claims not reached (you pressed End early) stay
    as they were."""
    attempts = _attempts_by_question(results)
    summary = {"asked": 0, "better": 0, "same": 0, "worse": 0, "first": 0, "at": utc_now().isoformat()}
    for index, claim_id in enumerate(claim_ids):
        if index >= len(attempts):
            break
        claim = _find_claim(resume.claims, claim_id)
        if claim is None:
            continue  # it is not in the newest version of the resume any more
        before = claim["score"]
        save_answer(claim, attempts[index])
        summary["asked"] += 1
        if before is None:
            summary["first"] += 1
        elif claim["score"] > before:
            summary["better"] += 1
        elif claim["score"] < before:
            summary["worse"] += 1
        else:
            summary["same"] += 1
    resume.last_grind = summary


def _attempts_by_question(results):
    """The interview's graded answers, one attempt per main question, with its follow-ups inside it."""
    attempts = []
    for result in results:
        if result["is_follow_up"] and attempts:
            attempts[-1]["follow_ups"].append({"question": result["question"], "answer": result["answer"], "score": result["score"]})
        else:
            attempts.append({
                "at": utc_now().isoformat(),
                "question": result["question"],
                "answer": result["answer"],
                "score": result["score"],
                "feedback": result["feedback"],
                "missed": result["missed"],
                "follow_ups": [],
            })
    return attempts


def build_response(resume):
    """The JSON the page gets: the resume's lines, every claim, the colour counts and what is due today."""
    counts = {"green": 0, "yellow": 0, "red": 0, "untested": 0}
    due = 0
    for claim in resume.claims:
        counts[claim["level"]] += 1
        if is_due(claim):
            due += 1
    if resume.claims:
        ready = round(100 * counts["green"] / len(resume.claims))
    else:
        ready = 0

    return {
        "id": str(resume.id),
        "filename": resume.filename,
        "version": resume.version,
        "lines": resume.lines,
        "removed_details": resume.removed_details,
        "claims": resume.claims,
        "counts": counts,
        "ready": ready,  # % of claims you defend well (green)
        "due": due,
        "changes": resume.changes,
        "last_grind": resume.last_grind,
        "open_grind": _open_grind(resume),
        "updated_at": resume.updated_at.isoformat(),
    }


def _open_grind(resume):
    """The id of a grind interview that is still going (to offer "Continue"), or None."""
    for grind in reversed(resume.grinds):
        if not grind["saved"]:
            return grind["interview_id"]
    return None


def _find_claim(claims, claim_id):
    """The claim with this id, or None."""
    for claim in claims:
        if claim["id"] == claim_id:
            return claim
    return None


def _lines(text):
    """The text's lines, trimmed, without the empty ones."""
    lines = []
    for line in text.split("\n"):
        if line.strip():
            lines.append(line.strip())
    return lines


def _count_status(claims, status):
    """How many claims have this status."""
    count = 0
    for claim in claims:
        if claim["status"] == status:
            count += 1
    return count


def _quotes(claims):
    """Just the words of each claim."""
    quotes = []
    for claim in claims:
        quotes.append(claim["quote"])
    return quotes
