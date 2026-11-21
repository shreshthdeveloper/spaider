"""What the panel lead, the agents and the judge must answer with (structured output)."""
from typing import Literal

from pydantic import BaseModel, Field


# The lead's brief for one agent.
class Brief(BaseModel):
    agent: str = Field(description="The agent's id, copied exactly as listed")
    brief: str = Field(description="Two or three sentences on what this agent should cover for this candidate")


# The lead's answer: the plan, and one brief per agent.
class PanelPlan(BaseModel):
    plan: str = Field(description="One sentence on the overall plan")
    briefs: list[Brief] = Field(description="One brief per agent listed")


class SearchDocuments(BaseModel):
    """Search the candidate's uploaded documents (study notes, books) for passages about a topic."""

    query: str = Field(description="A short search query, e.g. 'Kafka consumer groups'")


# One question an agent writes.
class DraftQuestion(BaseModel):
    question: str = Field(description="What the interviewer asks")
    key_points: list[str] = Field(description="3 to 5 short points that a strong answer covers")
    difficulty: Literal["easy", "medium", "hard"]
    based_on: str = Field(description="Exact words copied from the inputs or passages that made you ask this; empty if general")
    brief: str = Field(description="System design only: the scale and must-haves; otherwise empty")
    problem_id: str = Field(description="Coding only: the id of the picked problem; otherwise empty")


# An agent's answer: its questions.
class QuestionSet(BaseModel):
    questions: list[DraftQuestion]


# The judge's score card for one question.
class QuestionScore(BaseModel):
    id: str = Field(description="The question's id, copied exactly, e.g. technical-2")
    relevance: int = Field(description="1 to 5: fits this role, job description, resume and topics")
    level: int = Field(description="1 to 5: the right difficulty for the candidate's level")
    clarity: int = Field(description="1 to 5: one clear question, not vague or two questions in one")
    answer: int = Field(description="1 to 5: the key points are correct and cover what a strong answer needs")
    repeat_of: str = Field(description="The id of an EARLIER question this one repeats, or empty")
    reason: str = Field(description="One short sentence: the main weakness, or what makes it good")


# The judge's answer: a summary, a score card per question, and an optional send-back.
class Verdict(BaseModel):
    summary: str = Field(description="Two sentences on the quality and balance of the bank")
    scores: list[QuestionScore] = Field(description="One score card per question, in the same order")
    send_back_agent: str = Field(description="The id of one agent whose set must be redone, or empty")
    send_back_note: str = Field(description="What that agent must fix, or empty")
