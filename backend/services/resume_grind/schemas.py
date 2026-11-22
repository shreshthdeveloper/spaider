"""The shapes we ask the AI to answer in (structured output)."""
from typing import Literal

from pydantic import BaseModel, Field


# One claim the resume makes, copied word for word.
class FoundClaim(BaseModel):
    quote: str = Field(description="The claim copied word for word from the resume: one bullet point or one sentence")
    kind: Literal["number", "tech", "lead", "project"] = Field(
        description='"number": a result with a figure; "tech": a tool or skill they used; '
        '"lead": leading or owning something; "project": something they built'
    )
    likely_questions: list[str] = Field(description="2 hard questions an interviewer would ask to test this claim")


# The claim finder's answer.
class FoundClaims(BaseModel):
    claims: list[FoundClaim]


# One grind question, about one claim.
class GrindQuestion(BaseModel):
    question: str = Field(description="One hard question that makes the candidate prove the claim")
    key_points: list[str] = Field(
        description="3 or 4 things a convincing answer must say, e.g. how a number was measured, "
        "what the candidate did themselves, one problem they hit"
    )


# The question writer's answer: one question per claim, in the same order.
class GrindQuestions(BaseModel):
    questions: list[GrindQuestion]
