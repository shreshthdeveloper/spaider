"""Shared set-up for the tests: a test database, the fake AI model and the fake voice (tests/fakes.py).

Run from backend/:   pytest
The tests need a MongoDB: TEST_MONGO_URI (default mongodb://localhost:27017), database "spaider_test", which
is emptied before every test. Nothing calls OpenAI.
"""
import os

# Before the app is imported: the test database, and a key that can't reach OpenAI.
# (app.py loads .env, but never replaces a variable that is already set.)
os.environ["MONGO_URI"] = os.environ.get("TEST_MONGO_URI", "mongodb://localhost:27017")
os.environ["MONGO_DB"] = "spaider_test"
os.environ["OPENAI_API_KEY"] = "sk-test-not-used"

import pytest
from mongoengine.connection import get_db

import services.interview.nodes
import services.panel.nodes
import services.resume_grind.claims
import services.resume_grind.questions
import services.voice
from tests import fakes


def fake_model():
    """What every AI step gets instead of the real model."""
    return fakes.FakeModel()


services.interview.nodes.get_model = fake_model
services.panel.nodes.get_model = fake_model
services.resume_grind.claims.get_model = fake_model
services.resume_grind.questions.get_model = fake_model
services.voice.speak = fakes.fake_speak

from app import app


@pytest.fixture
def client():
    """A test client on an empty test database, with nothing recorded by the fakes yet."""
    get_db().client.drop_database("spaider_test")
    fakes.PROMPTS.clear()
    fakes.SPOKEN.clear()
    return app.test_client()

