"""The shapes we ask the AI to answer in (structured output)."""
from typing import Literal

from pydantic import BaseModel, Field


# A note Bella pins to one line of the code.
class LineNote(BaseModel):
    line: int = Field(description="The line number in the candidate's code that the note is about")
    text: str = Field(description="The note, at most 12 words, e.g. 'What happens if nums is empty?'")


# Bella's reaction while you code: what she says out loud, and up to 2 line notes.
class CodeReview(BaseModel):
    say: str = Field(description="What you say out loud to the candidate: 1 to 3 short sentences, at most one question")
    notes: list[LineNote] = Field(description="0 to 2 notes pinned to lines of the code")


# The AI's judgement of one rubric area: a level, a quote as evidence, and a comment.
class AreaCheck(BaseModel):
    area: str = Field(description="The rubric area, copied exactly as given")
    level: Literal["missing", "basic", "good", "strong"]
    evidence: str = Field(description="Exact words copied from the code or the conversation that show this area; empty if missing")
    comment: str = Field(description="One sentence for the candidate: what was good, or what is missing")


# The final report: one check per area, a summary, strengths, and what to improve.
class CodingGrade(BaseModel):
    checks: list[AreaCheck] = Field(description="One check per rubric area, in the same order")
    summary: str = Field(description="Two sentences on the solution as a whole")
    strengths: list[str] = Field(description="Up to 3 things done well")
    improve: list[str] = Field(description="Up to 3 things to study or fix next")
