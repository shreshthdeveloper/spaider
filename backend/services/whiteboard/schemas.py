"""The shapes we ask the AI to answer in (structured output)."""
from typing import Literal

from pydantic import BaseModel, Field


# A sticky note Bella pins on the board, next to a box (or loose).
class BoardNote(BaseModel):
    target: str = Field(description="The short name of the box the note is about, like b2, or empty for the board in general")
    text: str = Field(description="The note, at most 10 words, e.g. 'Single point of failure?'")


# Bella's reaction to the board: what she says out loud, and up to 2 sticky notes.
class BoardReview(BaseModel):
    say: str = Field(description="What you say out loud to the candidate: 1 to 3 short sentences, at most one question")
    notes: list[BoardNote] = Field(description="0 to 2 sticky notes to pin on the board next to the boxes you mean")


# The AI's judgement of one rubric area: a level, a quote as evidence, and a comment.
class AreaCheck(BaseModel):
    area: str = Field(description="The rubric area, copied exactly as given")
    level: Literal["missing", "basic", "good", "strong"]
    evidence: str = Field(description="Exact words copied from the board or the conversation that show this area; empty if missing")
    comment: str = Field(description="One sentence for the candidate: what was good, or what is missing")


# The final report: one check per area, a summary, strengths, and what to improve.
class WhiteboardGrade(BaseModel):
    checks: list[AreaCheck] = Field(description="One check per rubric area, in the same order")
    summary: str = Field(description="Two sentences on the design as a whole")
    strengths: list[str] = Field(description="Up to 3 things done well")
    improve: list[str] = Field(description="Up to 3 things to study or fix next")
