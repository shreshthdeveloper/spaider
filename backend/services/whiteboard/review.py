"""The interviewer looks at the board and reacts: what to say out loud, and up to 2 sticky notes."""
from services.text import conversation_text
from services.whiteboard.ai import ask_about_board
from services.whiteboard.diagram import describe
from services.whiteboard.prompts import REVIEW_PROMPT
from services.whiteboard.schemas import BoardReview

MAX_NOTES = 2


def review_board(session, scene, image, reply=""):
    """Returns {"say": "...", "notes": [{"target": <Excalidraw element id or "">, "text": "..."}]}."""
    board, names = describe(scene)
    text = (
        f"Question: {session.question}\n{session.brief}\n\n"
        f"The board now:\n{board}\n\n"
        f"Conversation so far:\n{conversation_text(session.messages)}"
    )
    if reply:
        text += f"\n\nThe candidate just said: {reply}"

    review = ask_about_board(BoardReview, REVIEW_PROMPT, text, image, "whiteboard_review", str(session.id))

    # The AI names boxes by their short name (b1, b2...). Turn that back into the real element id,
    # so the browser can pin the note next to that box. An unknown name becomes "" (a general note).
    notes = []
    for note in review.notes[:MAX_NOTES]:
        if note.text.strip():
            notes.append({"target": names.get(note.target.strip(), ""), "text": note.text.strip()[:80]})

    return {"say": review.say.strip(), "notes": notes}
