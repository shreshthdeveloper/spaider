"""Writes a grind's questions: one "prove it" question per claim, and what a convincing answer says."""
from langchain_core.messages import HumanMessage, SystemMessage

from services.llm import get_model
from services.resume_grind.prompts import GRIND_PROMPT
from services.resume_grind.schemas import GrindQuestions

MAX_KEY_POINTS = 4

# used when the AI wrote fewer questions than claims
BACKUP_POINTS = [
    "What the candidate did themselves, not the team",
    "How the result was measured or checked",
    "One problem they hit and how they solved it",
]


def write_questions(claims):
    """The plan for a mock interview: [{"question", "key_points"}], one per claim, in the same order."""
    writer = get_model().with_structured_output(GrindQuestions)
    answer = writer.invoke([SystemMessage(GRIND_PROMPT), HumanMessage(_claims_text(claims))])

    questions = []
    for index, claim in enumerate(claims):
        if index < len(answer.questions) and answer.questions[index].key_points:
            written = answer.questions[index]
            questions.append({"question": written.question, "key_points": written.key_points[:MAX_KEY_POINTS]})
        else:
            questions.append(_backup_question(claim))
    return questions


def _claims_text(claims):
    """The claims as numbered lines for the prompt, with what changed and what was asked last time."""
    text = ""
    for number, claim in enumerate(claims, start=1):
        text += f"{number}. Claim: {claim['quote']}\n"
        if claim["status"] == "changed":
            text += f"   CHANGED. The last resume said: {claim['before']}\n"
        if claim["attempts"]:
            last = claim["attempts"][-1]
            text += f"   Asked before: {last['question']} (scored {last['score']}/5)\n"
    return text


def _backup_question(claim):
    """A question for a claim the AI skipped: the likely question found with the claim."""
    if claim["likely_questions"]:
        question = claim["likely_questions"][0]
    else:
        question = f"Walk me through this line of your resume: {claim['quote']}"
    return {"question": question, "key_points": BACKUP_POINTS}
