from flask import Blueprint, jsonify, request

from models.resume import current_resume
from services import resume_grind_service
from services.question_bank.inputs import InputError, pdf_text
from services.resume_grind_service import ResumeError

resume_grind_bp = Blueprint("resume_grind", __name__)

MIN_TEXT = 200  # characters: anything shorter is not a resume
MAX_TEXT = 20000
GRIND_SIZES = [3, 5, 8]  # how many claims one grind asks about
MODES = ["text", "voice"]


@resume_grind_bp.get("/resume")
def get_resume():
    """GET /api/resume: your resume with every claim and its colour, or {"resume": null} before the first upload."""
    resume = current_resume()
    if resume is None:
        return jsonify(resume=None)
    return jsonify(resume=resume_grind_service.open_resume(resume))


@resume_grind_bp.post("/resume")
def upload_resume():
    """POST /api/resume (a form, because it can carry a PDF): file = the resume as a PDF, or text = pasted text.
    The first upload creates your resume; the next ones are new versions of it."""
    file = request.files.get("file")
    if file is not None and file.filename:
        first_bytes = file.stream.read(5)  # don't trust the file name: a real PDF starts with "%PDF-"
        file.stream.seek(0)
        if first_bytes != b"%PDF-":
            return jsonify(error=f"{file.filename} is not a real PDF"), 400
        try:
            text = pdf_text(file)
        except InputError as error:
            return jsonify(error=str(error)), 400
        filename = file.filename
    else:
        text = (request.form.get("text") or "").strip()
        filename = "Pasted text"

    if len(text) < MIN_TEXT:
        return jsonify(error="That is too short for a resume. Upload the PDF, or paste the whole text."), 400
    try:
        view = resume_grind_service.upload(text[:MAX_TEXT], filename)
    except ResumeError as error:
        return jsonify(error=str(error)), 400
    return jsonify(resume=view), 201


@resume_grind_bp.post("/resume/grind")
def start_grind():
    """POST /api/resume/grind  {count, mode}: starts a mock interview about your weakest claims that are due.
    Returns the interview, so the page can open it."""
    data = request.get_json(silent=True) or {}
    count = data.get("count", 5)
    mode = data.get("mode", "text")
    if count not in GRIND_SIZES:
        return jsonify(error=f"count must be one of {GRIND_SIZES}"), 400
    if mode not in MODES:
        return jsonify(error=f"mode must be one of {MODES}"), 400

    resume = current_resume()
    if resume is None:
        return jsonify(error="upload your resume first"), 404
    return jsonify(resume_grind_service.start_grind(resume, count, mode)), 201


@resume_grind_bp.delete("/resume")
def delete_resume():
    """DELETE /api/resume: removes your resume and its claims (the grind interviews stay)."""
    resume = current_resume()
    if resume is None:
        return jsonify(error="there is no resume"), 404
    resume_grind_service.delete_resume(resume)
    return jsonify(deleted=True)
