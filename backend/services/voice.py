"""Voice for the mock interview: the interviewer speaks (text to speech) and you answer out loud (speech to text).

Both use OpenAI's audio API directly. Every call is logged on the AI traces page.
"""
import hashlib
import threading
import time
from functools import lru_cache
from pathlib import Path

from openai import OpenAI

from models.trace import LLMTrace

SPEECH_MODEL = "gpt-4o-mini-tts"   # OpenAI plans to retire it in Jan 2027; change the name here when needed
VOICES = ["marin", "ash"]          # Bella's voice: the first that works is used
PANEL_VOICES = ["coral", "cedar", "sage", "ash", "shimmer"]  # the panelists' voices (services/panel/panelists.py)
SPEAKING_STYLE = "Speak like a friendly, calm, professional technical interviewer. Natural pace, clear words."
TRANSCRIBE_MODEL = "gpt-transcribe"

CACHE_DIR = Path(__file__).resolve().parents[1] / "tts_cache"  # backend/tts_cache (ignored by git)


class VoiceError(Exception):
    """OpenAI voice did not work. The browser then uses its own voice, or you type."""


@lru_cache
def _client():
    """The OpenAI client, made once. It reads OPENAI_API_KEY from the environment."""
    return OpenAI()


def speak(text, voice_name=""):
    """MP3 audio of the interviewer saying `text`. The same text is only paid for once: it is cached on disk.
    voice_name: a panelist's voice (one of PANEL_VOICES); empty means Bella's. If it fails, Bella's voice is used."""
    voices = list(VOICES)
    if voice_name in PANEL_VOICES:
        voices.insert(0, voice_name)
    # The file name is a fingerprint (hash) of the text and the voice settings: the same sentence always gives
    # the same name, so we can find it again, and a different sentence never collides with it.
    key = hashlib.sha256(f"{SPEECH_MODEL}|{voices}|{SPEAKING_STYLE}|{text}".encode()).hexdigest()
    cached = CACHE_DIR / f"{key}.mp3"
    if cached.exists():
        return cached.read_bytes()

    started = time.perf_counter()
    audio = None
    last_error = None
    for voice in voices:  # try each voice until one works
        try:
            response = _client().audio.speech.create(
                model=SPEECH_MODEL, voice=voice, input=text, instructions=SPEAKING_STYLE, response_format="mp3"
            )
            audio = response.read()
            break
        except Exception as error:
            last_error = error

    if audio is None:
        _log("voice: speak", SPEECH_MODEL, text, "", started, error=str(last_error))
        raise VoiceError(f"OpenAI voice failed: {last_error}")

    CACHE_DIR.mkdir(exist_ok=True)
    cached.write_bytes(audio)
    _log("voice: speak", SPEECH_MODEL, text, f"({len(audio) // 1024} KB of audio, voice {voice})", started)
    return audio


def prepare(texts, voice_name=""):
    """Makes the voice for these texts in the background and caches it, so later each one plays at once
    (speak() finds it in the cache). Used for planned questions: an interview's, or one panelist's."""
    threading.Thread(target=_speak_all, args=(texts, voice_name), daemon=True).start()


def _speak_all(texts, voice_name):
    """speak() each text, one after another (this runs in the background thread from prepare())."""
    for text in texts:
        try:
            speak(text, voice_name)
        except VoiceError:
            return  # no OpenAI voice right now: the browser will ask again when it needs it


def transcribe(audio, filename, mime_type, hint=""):
    """The words in a recorded answer. `hint` (the question) helps with technical terms."""
    started = time.perf_counter()
    try:
        result = _client().audio.transcriptions.create(
            model=TRANSCRIBE_MODEL, file=(filename, audio, mime_type), prompt=hint
        )
    except Exception as error:
        _log("voice: transcribe", TRANSCRIBE_MODEL, f"({len(audio) // 1024} KB of audio)", "", started, error=str(error))
        raise VoiceError(f"Speech-to-text failed: {error}")

    text = (result.text or "").strip()
    _log("voice: transcribe", TRANSCRIBE_MODEL, f"({len(audio) // 1024} KB of audio)", text, started)
    return text


def _log(label, model, sent, received, started, error=None):
    """Save the call on the AI traces page. Never let logging break the voice."""
    try:
        LLMTrace(
            label=label,
            model=model,
            prompt=[{"role": "human", "content": sent}],
            output=received,
            duration_ms=round((time.perf_counter() - started) * 1000),
            error=error,
        ).save()
    except Exception:
        pass
