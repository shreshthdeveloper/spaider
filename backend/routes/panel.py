from flask import Blueprint, jsonify, request

from models.panel import find_panel
from models.resume import current_resume
from services import panel_service
from services.panel.panelists import find_panelist
from services.question_bank.inputs import InputError, pdf_text
from services.resume_grind.privacy import remove_contact_details
from services.sse import sse_response

panel_bp = Blueprint("panel", __name__)

LEVELS = ["Junior", "Mid", "Senior", "Lead"]
QUESTION_COUNTS = [4, 6, 8]  # main questions for the whole panel
MODES = ["text", "voice"]  # voice = a video call where the panelists speak
MIN_PANEL = 2
MAX_PANEL = 4
MAX_FIELD = 120  # role, company
MAX_TEXT = 20000  # a pasted (or uploaded) JD or resume
MAX_ANSWER = 5000
WEAK_LEVELS = ["red", "yellow"]  # Resume grind lines the resume panelist should test first
MAX_WEAK_LINES = 6


class BadRequest(Exception):
    """Something wrong in the setup form. The route turns it into a 400 error with this message."""


@panel_bp.get("/panels/panelists")
def list_panelists():
    """GET /api/panels/panelists: everyone who can sit on a panel."""
    return jsonify(panelists=panel_service.list_panelists())


@panel_bp.get("/panels")
def list_panels():
    """GET /api/panels: your recent panel interviews, newest first."""
    return jsonify(panels=panel_service.list_recent_panels())


@panel_bp.post("/panels")
def start_panel():
    """POST /api/panels (a form, because the JD and resume can be PDFs): role, company, level, jd or jd_file,
    resume or resume_file, use_resume_grind ("yes" = use the Resume grind's resume and its weak lines),
    panelists (2 to 4 of them), num_questions, follow_ups, mode ("voice" or "text"). Runs the brief and returns
    the first question."""
    try:
        inputs = _read_inputs()
        panelist_ids = _read_panelists()
        num_questions = int(request.form.get("num_questions", 6))
        follow_ups = int(request.form.get("follow_ups", 1))
        mode = request.form.get("mode", "voice")
    except BadRequest as error:
        return jsonify(error=str(error)), 400
    except ValueError:
        return jsonify(error="num_questions and follow_ups must be whole numbers"), 400
    if num_questions not in QUESTION_COUNTS:
        return jsonify(error=f"num_questions must be one of {QUESTION_COUNTS}"), 400
    if not 0 <= follow_ups <= 2:
        return jsonify(error="follow_ups must be 0, 1 or 2"), 400
    if mode not in MODES:
        return jsonify(error=f"mode must be one of {MODES}"), 400

    panel = panel_service.start_panel(inputs, panelist_ids, num_questions, follow_ups, mode)
    return jsonify(panel), 201


@panel_bp.get("/panels/<panel_id>")
def get_panel(panel_id):
    """GET /api/panels/<id>: the conversation and the current question, or the report once it's finished."""
    record = find_panel(panel_id)
    if record is None:
        return jsonify(error="panel interview not found"), 404
    return jsonify(panel_service.build_response(record))


@panel_bp.post("/panels/<panel_id>/answer/live")
def answer_live(panel_id):
    """POST /api/panels/<id>/answer/live  {answer}: grades your answer, lets every panelist write their note,
    and the moderator picks what comes next. Sent as a live stream (Server-Sent Events) step by step."""
    record, error = _open_panel(panel_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    text = (data.get("answer") or "").strip()
    if not text:
        return jsonify(error="answer is required"), 400
    if len(text) > MAX_ANSWER:
        return jsonify(error=f"answer is too long (max {MAX_ANSWER} characters)"), 400
    return sse_response(panel_service.answer_live(record, text))


@panel_bp.post("/panels/<panel_id>/end")
def end_panel(panel_id):
    """POST /api/panels/<id>/end: stops early; the panel decides on what you answered so far."""
    record, error = _open_panel(panel_id)
    if error:
        return error
    return jsonify(panel_service.end_panel(record))


@panel_bp.post("/panels/<panel_id>/retry")
def retry_panel(panel_id):
    """POST /api/panels/<id>/retry: runs the last step again after it failed (for example, the AI was down)."""
    record, error = _open_panel(panel_id)
    if error:
        return error
    return jsonify(panel_service.retry_last_step(record))


def _open_panel(panel_id):
    """Returns (the panel, None) if it exists and isn't finished, or (None, an error response)."""
    record = find_panel(panel_id)
    if record is None:
        return None, (jsonify(error="panel interview not found"), 404)
    if record.status == "finished":
        return None, (jsonify(error="this panel interview is already finished"), 409)
    return record, None


def _read_inputs():
    """The role, JD and resume from the form, checked. Contact details are taken out of the resume."""
    inputs = {
        "role": _field("role", MAX_FIELD),
        "company": _field("company", MAX_FIELD),
        "level": request.form.get("level", "Mid"),
        "jd": _text_or_pdf("jd"),
        "resume": "",
        "weak_lines": [],
    }
    if inputs["level"] not in LEVELS:
        raise BadRequest(f"level must be one of {LEVELS}")

    if request.form.get("use_resume_grind") == "yes" and current_resume() is not None:
        resume = current_resume()
        inputs["resume"] = resume.text  # contact details were already taken out on upload
        for claim in resume.claims:
            if claim["level"] in WEAK_LEVELS and len(inputs["weak_lines"]) < MAX_WEAK_LINES:
                inputs["weak_lines"].append(claim["quote"])
    else:
        inputs["resume"], _removed = remove_contact_details(_text_or_pdf("resume"))

    if not (inputs["role"] or inputs["jd"]):
        raise BadRequest("give the panel a role or a job description")
    return inputs


def _read_panelists():
    """The panelists picked on the form: 2 to 4 known ids, no repeats."""
    picked = []
    for panelist_id in request.form.getlist("panelists"):
        if find_panelist(panelist_id) is None:
            raise BadRequest(f"unknown panelist: {panelist_id}")
        if panelist_id not in picked:
            picked.append(panelist_id)
    if not MIN_PANEL <= len(picked) <= MAX_PANEL:
        raise BadRequest(f"pick {MIN_PANEL} to {MAX_PANEL} panelists")
    return picked


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
    try:
        return pdf_text(file)[:MAX_TEXT]
    except InputError as error:
        raise BadRequest(str(error))
