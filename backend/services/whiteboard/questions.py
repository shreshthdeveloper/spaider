"""The system design questions you can pick. Add one here and it shows up on the setup screen."""

QUESTIONS = [
    {
        "id": "url-shortener",
        "title": "Design a URL shortener",
        "brief": "Like bit.ly: 100 million new links a month, about 10 times more reads than writes, and links never break.",
    },
    {
        "id": "chat",
        "title": "Design a chat app",
        "brief": "One-to-one and group chats, online status, messages delivered in real time and kept forever.",
    },
    {
        "id": "rate-limiter",
        "title": "Design a rate limiter",
        "brief": "Limit each user to N requests a minute across many API servers, adding almost no delay.",
    },
    {
        "id": "news-feed",
        "title": "Design a news feed",
        "brief": "Users follow others and see a ranked feed of their posts. 300 million daily users; some have millions of followers.",
    },
    {
        "id": "file-storage",
        "title": "Design file storage like Dropbox",
        "brief": "Upload, sync and share files across devices: large files, offline edits and version history.",
    },
    {
        "id": "notifications",
        "title": "Design a notification system",
        "brief": "Send push, email and SMS to millions of users, with retries, user preferences and no duplicates.",
    },
    {
        "id": "rag-assistant",
        "title": "Design a RAG document assistant",
        "brief": "Employees ask questions about company PDFs and answers cite pages. 10,000 documents, permissions per team.",
    },
    {
        "id": "ride-sharing",
        "title": "Design ride sharing like Uber",
        "brief": "Match riders with nearby drivers in seconds, track live locations and handle surge pricing.",
    },
]


def find_question(question_id):
    """The ready-made question with this id, or None."""
    for question in QUESTIONS:
        if question["id"] == question_id:
            return question
    return None
