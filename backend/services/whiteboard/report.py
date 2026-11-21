"""The final report of a whiteboard round: each rubric area judged by the AI, then checked and scored
in code (services/rubric.py: "no proof, no points")."""
from services.rubric import average_points, candidate_words, rubric_text, score_areas
from services.text import conversation_text
from services.whiteboard.ai import ask_about_board
from services.whiteboard.diagram import describe
from services.whiteboard.prompts import REPORT_PROMPT
from services.whiteboard.schemas import WhiteboardGrade

# What a good answer shows, area by area.
RUBRIC = [
    ("Requirements", "what the system must do, and at what scale (users, requests per second, data size)"),
    ("Components", "the main parts drawn and named: clients, API, services, storage"),
    ("Data flow", "arrows that show how a request moves through the system"),
    ("Storage", "a sensible database or store for the data, and why"),
    ("Scaling", "caching, load balancing, sharding or queues where the load is high"),
    ("Reliability", "what happens when a part fails: replicas, retries, no single point of failure"),
    ("Trade-offs", "why these choices, and what was given up"),
]


def write_report(session, scene, image):
    """The report: each area's level and points, the overall score, and the AI's summary."""
    board, _ = describe(scene)
    text = (
        f"Question: {session.question}\n{session.brief}\n\n"
        f"Rubric:\n{rubric_text(RUBRIC)}\n\n"
        f"The final board:\n{board}\n\n"
        f"Conversation:\n{conversation_text(session.messages, last=40)}"
    )
    grade = ask_about_board(WhiteboardGrade, REPORT_PROMPT, text, image, "whiteboard_report", str(session.id))

    # An area only scores if its quote is really on the board or in what YOU said
    # (the interviewer's own words don't count). Punctuation and capitals may differ.
    proof = board + " " + candidate_words(session.messages)
    areas = score_areas(RUBRIC, grade.checks, words=proof)

    return {
        "overall": round(average_points(areas), 1),
        "areas": areas,
        "summary": grade.summary,
        "strengths": grade.strengths[:3],
        "improve": grade.improve[:3],
    }
