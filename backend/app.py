"""The starting point of the backend. Run it with `python app.py` (it listens on port 5001).

It creates the Flask app, connects to MongoDB, and plugs in every group of routes. Flask calls a group of
routes a "blueprint": each file in routes/ is one blueprint, and all of them live under /api.
"""
from dotenv import load_dotenv
from flask import Flask

from db import init_db

from routes.chat import chat_bp
from routes.coding import coding_bp
from routes.documents import documents_bp
from routes.evals import evals_bp
from routes.health import health_bp
from routes.interview import interview_bp
from routes.panel import panel_bp
from routes.question_bank import question_bank_bp
from routes.resume_grind import resume_grind_bp
from routes.stats import stats_bp
from routes.traces import traces_bp
from routes.voice import voice_bp
from routes.whiteboard import whiteboard_bp

load_dotenv()  # reads the .env file (the OpenAI key, MongoDB settings) into the environment


def create_app():
    """Builds the Flask app: its settings, the MongoDB connection, and every group of routes under /api."""
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # uploads bigger than 10 MB are refused

    init_db()
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(interview_bp, url_prefix="/api")
    app.register_blueprint(documents_bp, url_prefix="/api")
    app.register_blueprint(traces_bp, url_prefix="/api")
    app.register_blueprint(voice_bp, url_prefix="/api")
    app.register_blueprint(whiteboard_bp, url_prefix="/api")
    app.register_blueprint(coding_bp, url_prefix="/api")
    app.register_blueprint(stats_bp, url_prefix="/api")
    app.register_blueprint(question_bank_bp, url_prefix="/api")
    app.register_blueprint(evals_bp, url_prefix="/api")
    app.register_blueprint(resume_grind_bp, url_prefix="/api")
    app.register_blueprint(panel_bp, url_prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(port=5001, debug=True)
