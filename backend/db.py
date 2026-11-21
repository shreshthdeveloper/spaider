"""The connection to MongoDB. The address and database name come from the environment (.env)."""
import os

from mongoengine import connect
from mongoengine.connection import get_db
from pymongo.errors import PyMongoError


def init_db():
    """Connects once, when the app starts. Every model in models/ then uses this connection."""
    connect(
        db=os.getenv("MONGO_DB", "interview_coach"),
        host=os.getenv("MONGO_URI", "mongodb://localhost:27017"),
        serverSelectionTimeoutMS=3000,  # give up after 3 seconds if MongoDB is not running
    )


def is_up():
    """True if MongoDB answers a quick "ping" right now (the sidebar shows this)."""
    try:
        get_db().command("ping")
        return True
    except PyMongoError:
        return False
