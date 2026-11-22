from flask import Blueprint, Response, jsonify, request

from services import voice
from services.voice import VoiceError

voice_bp = Blueprint("voice", __name__)

MAX_TEXT_LENGTH = 2000
AUDIO_TYPES = {"audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav"}


@voice_bp.post("/voice/speak")
def speak():
    """POST /api/voice/speak  {text, voice}: an interviewer saying `text`, as MP3 audio. voice is optional: a
    panelist's voice (one of voice.PANEL_VOICES); without it, Bella's voice."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    voice_name = data.get("voice") or ""
    if voice_name and voice_name not in voice.PANEL_VOICES:
        return jsonify(error=f"voice must be one of {voice.PANEL_VOICES}"), 400
    if not text:
        return jsonify(error="text is required"), 400
    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error=f"text is too long (max {MAX_TEXT_LENGTH} characters)"), 400

    try:
        audio = voice.speak(text, voice_name)
    except VoiceError as error:
        return jsonify(error=str(error)), 503  # the browser falls back to its own voice
    return Response(audio, mimetype="audio/mpeg")


@voice_bp.post("/voice/transcribe")
def transcribe():
    """POST /api/voice/transcribe (a form with an "audio" file and a "hint"): the words in your recorded
    answer."""
    file = request.files.get("audio")
    if file is None:
        return jsonify(error="no audio was sent"), 400
    mime_type = file.mimetype.split(";")[0]
    if mime_type not in AUDIO_TYPES:
        return jsonify(error="unsupported audio format"), 400
    audio = file.read()
    if not audio:
        return jsonify(error="the recording is empty"), 400

    hint = (request.form.get("hint") or "")[:500]
    try:
        text = voice.transcribe(audio, f"answer.{AUDIO_TYPES[mime_type]}", mime_type, hint)
    except VoiceError as error:
        return jsonify(error=str(error)), 503
    return jsonify(text=text)
