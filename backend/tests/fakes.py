"""A fake AI model and a fake voice for the tests: no API key, no network, the same answer every time.

The fake model answers in the shape each step asks for (with_structured_output), with simple rules the tests
rely on:
  - grading: a key point counts as covered when its FIRST word appears in the answer
  - resume claims: every line that starts with "- " is a claim (plus one made-up claim, which must be dropped)
  - panel notes: a panelist wants a follow-up when the answer doesn't mention "beta"
  - the panel moderator always picks the last follow-up it is offered
"""
import re

from services.interview.schemas import FollowUp, Grade, InterviewPlan, PlannedQuestion, PointCheck, ReportSummary
from services.panel.schemas import ModeratorChoice, PanelBrief, PanelDebrief, PanelistQuestions, PanelNote, PanelVerdict
from services.resume_grind.schemas import FoundClaim, FoundClaims, GrindQuestion, GrindQuestions

PROMPTS = {}  # schema name -> every prompt it was given (the last message), for tests to look at
SPOKEN = []  # (text, voice) for every voice the fake speak() made

KEY_POINTS = ["alpha detail", "beta detail", "gamma detail"]


class FakeModel:
    """Stands in for get_model()."""

    def with_structured_output(self, schema):
        """Like the real model: returns something whose invoke() answers in the shape of `schema`."""
        return FakeStructured(schema)


class FakeStructured:
    """Answers one kind of question (one schema) with the rules above."""

    def __init__(self, schema):
        self.schema = schema

    def invoke(self, messages, config=None):
        """Records the prompt, then answers with the rule for this schema."""
        system = messages[0].content
        prompt = messages[-1].content
        PROMPTS.setdefault(self.schema.__name__, []).append(prompt)
        return ANSWERS[self.schema](system, prompt)


def fake_speak(text, voice_name=""):
    """Stands in for services.voice.speak: remembers what it was asked to say, and returns a few bytes."""
    SPOKEN.append((text, voice_name))
    return b"ID3fake"


# ---------------------------------------------------------------- the mock interview
def _plan(system, prompt):
    """N questions about Kafka, each with the same three key points."""
    count = int(re.search(r"Number of questions: (\d+)", prompt).group(1))
    questions = []
    for number in range(1, count + 1):
        questions.append(PlannedQuestion(question=f"Question {number}: how do Kafka partitions work?", key_points=KEY_POINTS))
    return InterviewPlan(questions=questions)


def _grade(system, prompt):
    """Covered = the point's first word is in the answer (and that word is the evidence)."""
    answer = _candidate_answer(prompt)
    checks = []
    for point in re.findall(r"^\d+\. (.+)$", prompt, re.M):
        first_word = point.split()[0]
        covered = first_word in answer
        checks.append(PointCheck(point=point, covered=covered, evidence=first_word if covered else ""))
    return Grade(checks=checks, feedback="Fake feedback.")


def _follow_up(system, prompt):
    return FollowUp(question="Can you say more about that?")


def _report(system, prompt):
    return ReportSummary(summary="A fake summary.", strengths=["clear"], improve=["depth"])


# ---------------------------------------------------------------- the Resume grind
def _claims(system, prompt):
    """Every "- " line is a claim, plus one the resume doesn't contain."""
    claims = []
    for line in re.findall(r"^- (.+)$", prompt, re.M):
        kind = "number" if re.search(r"\d", line) else "tech"
        claims.append(FoundClaim(quote=line, kind=kind, likely_questions=[f"How did you {line[:20]}?", "Who else worked on it?"]))
    claims.append(FoundClaim(quote="Invented the internet single handedly", kind="lead", likely_questions=["?"]))
    return FoundClaims(claims=claims)


def _grind_questions(system, prompt):
    """One question per numbered claim."""
    count = len(re.findall(r"^\d+\. Claim:", prompt, re.M))
    questions = []
    for number in range(1, count + 1):
        questions.append(GrindQuestion(question=f"Prove claim {number}", key_points=["measured with a baseline", "own part in the work"]))
    return GrindQuestions(questions=questions)


# ---------------------------------------------------------------- the panel interview
def _brief(system, prompt):
    """The asked number of questions for every panelist listed."""
    count = int(re.search(r"Write (\d+) questions", prompt).group(1))
    plans = []
    for panelist_id in re.findall(r"^- id: (\w+) \|", prompt, re.M):
        questions = []
        for number in range(1, count + 1):
            questions.append(PlannedQuestion(question=f"{panelist_id} question {number}?", key_points=KEY_POINTS))
        plans.append(PanelistQuestions(panelist=panelist_id, questions=questions))
    return PanelBrief(plans=plans)


def _note(system, prompt):
    """A follow-up wish when the answer doesn't mention beta."""
    name = re.search(r"You are (\w+)", system).group(1)
    if "beta" in _candidate_answer(prompt):
        return PanelNote(note=f"{name}: solid.", follow_up="", follow_up_points=[])
    return PanelNote(note=f"{name}: missed beta.", follow_up=f"{name} asks: what about beta?", follow_up_points=["beta covered"])


def _moderator(system, prompt):
    """Always the last follow-up offered."""
    wishes = re.findall(r"^- follow_up by (\w+) \(", prompt, re.M)
    return ModeratorChoice(action="follow_up", speaker=wishes[-1], reason=f"{wishes[-1]} builds on that from another angle.")


def _verdict(system, prompt):
    """Hire if any answer scored 5."""
    decision = "hire" if "Score: 5" in prompt else "no hire"
    return PanelVerdict(decision=decision, reasons=["A fake reason."])


def _debrief(system, prompt):
    return PanelDebrief(summary="A fake debrief.", agreed=["clear"], disagreed=[], improve=["beta"])


def _candidate_answer(prompt):
    """The text between <candidate_answer> tags, in lower case."""
    return prompt.split("<candidate_answer>\n")[1].split("\n</candidate_answer>")[0].lower()


ANSWERS = {
    InterviewPlan: _plan,
    Grade: _grade,
    FollowUp: _follow_up,
    ReportSummary: _report,
    FoundClaims: _claims,
    GrindQuestions: _grind_questions,
    PanelBrief: _brief,
    PanelNote: _note,
    ModeratorChoice: _moderator,
    PanelVerdict: _verdict,
    PanelDebrief: _debrief,
}
