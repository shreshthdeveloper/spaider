"""The shapes we ask the AI to answer in (structured output)."""
from typing import Literal

from pydantic import BaseModel, Field

from services.interview.schemas import PlannedQuestion


# One panelist's questions, written in the brief.
class PanelistQuestions(BaseModel):
    panelist: str = Field(description="The panelist's id, exactly as given")
    questions: list[PlannedQuestion]


# The brief: every panelist's questions.
class PanelBrief(BaseModel):
    plans: list[PanelistQuestions]


# One panelist's private note after an answer (the other panelists read it; the candidate doesn't, live).
class PanelNote(BaseModel):
    note: str = Field(description="1 or 2 sentences for the other panelists: what you noticed in the answer, from your focus")
    follow_up: str = Field(description="One follow-up question you want to ask now, or an empty string if you have none")
    follow_up_points: list[str] = Field(description="2 or 3 things a good answer to your follow-up says; empty if no follow-up")


# The moderator's pick, when there is a real choice.
class ModeratorChoice(BaseModel):
    action: Literal["follow_up", "new_question"]
    speaker: str = Field(description="For a follow-up: the id of the panelist whose follow-up is asked")
    reason: str = Field(description="One short sentence the candidate may see: why this, and why now")


# One panelist's decision at the end.
class PanelVerdict(BaseModel):
    decision: Literal["strong hire", "hire", "no hire", "strong no hire"]
    reasons: list[str] = Field(description="2 or 3 short reasons, each pointing at something the candidate said")


# The hiring committee's summary (the decision itself is counted by code).
class PanelDebrief(BaseModel):
    summary: str = Field(description="2 or 3 sentences on how the interview went and why the panel decided as it did")
    agreed: list[str] = Field(description="Up to 3 things the whole panel agreed on")
    disagreed: list[str] = Field(description="Up to 3 things panelists saw differently; empty if they agreed")
    improve: list[str] = Field(description="Up to 3 things the candidate should work on next")
