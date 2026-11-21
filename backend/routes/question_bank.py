from flask import Blueprint, jsonify, request

from models.document import find_document
from models.question_bank import find_bank
from services import question_bank_service
from services.question_bank.agents import AGENTS
from services.question_bank.inputs import InputError, pdf_text
from services.question_bank_service import PracticeError

question_bank_bp = Blueprint("question_bank", __name__)

INTERVIEW_TYPES = ["Technical", "System design", "Coding", "Behavioural", "Mixed"]
LEVELS = ["Junior", "Mid", "Senior", "Lead"]
CODING_MODES = ["interview", "practice"]
MAX_FIELD = 120  # company, position
MAX_TOPICS = 600
MAX_TEXT = 20000  # a pasted (or uploaded) job description or resume
MAX_PICKED = 50
MAX_DOCUMENTS = 3  # documents the agents may search
MAX_BRIEF = 800  # a brief you edit in review mode
MAX_NOTE = 600  # the judge's note, if you edit it


class BadRequest(Exception):
    """Something wrong in the request. The route turns it into a 400 error with this message."""
    pass


def _field(name, limit):
    """A short text field from the form, trimmed, and at most `limit` characters."""
    value = (request.form.get(name) or "").strip()
    if len(value) > limit:
        raise BadRequest(f"{name} is too long (max {limit} characters)")
    return value


def _text_or_pdf(name):
    """A pasted text field, or the PDF uploaded instead of it (<name>_file)."""
    file = request.files.get(f"{name}_file")
    if file is None or file.filename == "":
        return _field(name, MAX_TEXT)
    first_bytes = file.stream.read(5)  # don't trust the file name: a real PDF starts with "%PDF-"
    file.stream.seek(0)
    if first_bytes != b"%PDF-":
        raise BadRequest(f"{file.filename} is not a real PDF")
    return pdf_text(file)[:MAX_TEXT]


def _read_inputs():
    """Everything the panel reads (the role, JD, resume, topics and documents), checked."""
    inputs = {
        "company": _field("company", MAX_FIELD),
        "position": _field("position", MAX_FIELD),
        "interview_type": request.form.get("interview_type", "Mixed"),
        "level": request.form.get("level", "Mid"),
        "topics": _field("topics", MAX_TOPICS),
        "jd": _text_or_pdf("jd"),
        "resume": _text_or_pdf("resume"),
    }
    if inputs["interview_type"] not in INTERVIEW_TYPES:
        raise BadRequest(f"interview_type must be one of {', '.join(INTERVIEW_TYPES)}")
    if inputs["level"] not in LEVELS:
        raise BadRequest(f"level must be one of {', '.join(LEVELS)}")
    if not (inputs["position"] or inputs["topics"] or inputs["jd"] or inputs["resume"]):
        raise BadRequest("give the panel something to work from: a position, topics, a job description or a resume")
    inputs["documents"] = _read_documents()
    return inputs


def _read_documents():
    """The uploaded documents the agents may search (from the Documents page)."""
    document_ids = []
    for document_id in request.form.getlist("documents"):
        if document_id not in document_ids:  # the same document twice counts once
            document_ids.append(document_id)
    if len(document_ids) > MAX_DOCUMENTS:
        raise BadRequest(f"pick at most {MAX_DOCUMENTS} documents")
    documents = []
    for document_id in document_ids:
        document = find_document(document_id)
        if document is None:
            raise BadRequest("one of the documents was not found")
        documents.append({"id": str(document.id), "filename": document.filename})
    return documents


def _read_agents():
    """The chosen agents, in the panel's order."""
    picked = request.form.getlist("agents")
    agent_ids = []
    for agent in AGENTS:
        if agent["id"] in picked:
            agent_ids.append(agent["id"])
    if not agent_ids:
        raise BadRequest("pick at least one agent")
    return agent_ids


@question_bank_bp.get("/question-banks/agents")
def list_agents():
    """GET /api/question-banks/agents: the agents you can put on the panel."""
    return jsonify(agents=question_bank_service.list_agents())


@question_bank_bp.get("/question-banks")
def list_banks():
    """GET /api/question-banks: your recent banks, newest first."""
    return jsonify(banks=question_bank_service.list_recent())


@question_bank_bp.post("/question-banks")
def create_bank():
    """POST /api/question-banks (a form, not JSON, because the JD and the resume can be PDF files): starts
    the panel in the background and returns the new bank at once."""
    try:
        inputs = _read_inputs()
        agent_ids = _read_agents()
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    except InputError as problem:
        return jsonify(error=str(problem)), 422
    review = request.form.get("review") in ("true", "1", "on")
    return jsonify(question_bank_service.create_bank(inputs, agent_ids, review)), 201


@question_bank_bp.get("/question-banks/<bank_id>")
def get_bank(bank_id):
    """GET /api/question-banks/<id>: the bank and its live pipeline. The page asks again every second while
    it runs."""
    bank = find_bank(bank_id)
    if bank is None:
        return jsonify(error="question bank not found"), 404
    return jsonify(question_bank_service.build_response(bank))


@question_bank_bp.post("/question-banks/<bank_id>/retry")
def retry_bank(bank_id):
    """POST /api/question-banks/<id>/retry: runs the whole panel again, with the same inputs."""
    bank = find_bank(bank_id)
    if bank is None:
        return jsonify(error="question bank not found"), 404
    if bank.status == "running":
        return jsonify(error="the panel is still working on this bank"), 409
    return jsonify(question_bank_service.run_again(bank))


@question_bank_bp.delete("/question-banks/<bank_id>")
def delete_bank(bank_id):
    """DELETE /api/question-banks/<id>: deletes a bank (not while its panel is working)."""
    bank = find_bank(bank_id)
    if bank is None:
        return jsonify(error="question bank not found"), 404
    if bank.status == "running":
        return jsonify(error="wait until the panel is done"), 409
    bank.delete()
    return jsonify(deleted=True)


@question_bank_bp.post("/question-banks/<bank_id>/practice")
def practise(bank_id):
    """POST /api/question-banks/<id>/practice  {question_ids, voice, coding_mode}: starts a round from the
    picked questions."""
    bank = find_bank(bank_id)
    if bank is None:
        return jsonify(error="question bank not found"), 404
    if bank.status != "done":
        return jsonify(error="this bank is not ready yet"), 409

    data = request.get_json(silent=True) or {}
    question_ids = data.get("question_ids")
    if not isinstance(question_ids, list) or not 1 <= len(question_ids) <= MAX_PICKED:
        return jsonify(error=f"question_ids must be a list of 1 to {MAX_PICKED} ids"), 400
    coding_mode = data.get("coding_mode", "interview")
    if coding_mode not in CODING_MODES:
        return jsonify(error=f"coding_mode must be one of {', '.join(CODING_MODES)}"), 400

    try:
        result = question_bank_service.practise(bank, question_ids, data.get("voice") is True, coding_mode)
    except PracticeError as problem:
        return jsonify(error=str(problem)), 400
    return jsonify(result), 201


@question_bank_bp.post("/question-banks/<bank_id>/review")
def review_bank(bank_id):
    """Review mode: your decision where the panel paused (human in the loop)."""
    bank = find_bank(bank_id)
    if bank is None:
        return jsonify(error="question bank not found"), 404
    if bank.status != "needs_you":
        return jsonify(error="the panel is not waiting for you"), 409
    data = request.get_json(silent=True) or {}
    try:
        if bank.pending["kind"] == "plan":
            decision = _read_plan_decision(data, bank.pending)
        else:
            decision = _read_verdict_decision(data, bank.pending)
    except BadRequest as problem:
        return jsonify(error=str(problem)), 400
    return jsonify(question_bank_service.resume(bank, decision))


def _read_plan_decision(data, pending):
    """{"agents": [the agents to keep], "briefs": {agent_id: brief}}. Only the panel's own agents count."""
    panel = pending["briefs"]  # agent id -> the lead's brief

    agents = data.get("agents")
    if not isinstance(agents, list) or not agents:
        raise BadRequest("keep at least one of the panel's agents")
    for agent_id in agents:
        if agent_id not in panel:
            raise BadRequest(f"{agent_id} is not on this panel")

    briefs = data.get("briefs") or {}
    if not isinstance(briefs, dict):
        raise BadRequest("briefs must map the panel's agents to text")
    clean_briefs = {}
    for agent_id, brief in briefs.items():
        if agent_id not in panel or not isinstance(brief, str):
            raise BadRequest("briefs must map the panel's agents to text")
        if len(brief) > MAX_BRIEF:
            raise BadRequest(f"a brief is too long (max {MAX_BRIEF} characters)")
        clean_briefs[agent_id] = brief.strip()

    return {"agents": agents, "briefs": clean_briefs}


def _read_verdict_decision(data, pending):
    """{"allow_send_back": bool, "send_back_note": text, "restore": [dropped question ids to keep]}"""
    dropped_ids = []
    for drop in pending["drops"]:
        dropped_ids.append(drop["id"])

    restore = data.get("restore") or []
    if not isinstance(restore, list):
        raise BadRequest("restore must be a list of question ids")
    for question_id in restore:
        if question_id not in dropped_ids:
            raise BadRequest("restore must list questions the judge dropped")

    note = data.get("send_back_note") or ""
    if not isinstance(note, str) or len(note) > MAX_NOTE:
        raise BadRequest(f"send_back_note must be text (max {MAX_NOTE} characters)")

    return {"allow_send_back": data.get("allow_send_back") is True, "send_back_note": note.strip(), "restore": restore}
