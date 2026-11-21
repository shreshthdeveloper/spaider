"""The shapes we ask the LLM to answer in (structured output)."""
from pydantic import BaseModel, Field


# One planned question, with the key points a strong answer must mention.
class PlannedQuestion(BaseModel):
    question: str = Field(description="One open interview question")
    key_points: list[str] = Field(description="3 to 5 short facts a strong answer must mention, one fact each")


# The planner's answer: the list of questions.
class InterviewPlan(BaseModel):
    questions: list[PlannedQuestion]


# The grader's call on one key point: covered or not, with a quote from the answer.
class PointCheck(BaseModel):
    point: str = Field(description="The key point, copied exactly as given")
    covered: bool = Field(description="True only if the answer clearly states this idea")
    evidence: str = Field(description="Exact words copied from the answer that cover the point; empty if not covered")


# The grader's answer: one check per key point, and feedback for the candidate.
class Grade(BaseModel):
    checks: list[PointCheck] = Field(description="One check per key point, in the same order")
    feedback: str = Field(description="One or two sentences for the candidate: what was good and what was missing")


# The follow-up writer's answer: one short question.
class FollowUp(BaseModel):
    question: str = Field(description="One short follow-up question")


# The report writer's answer: a summary, strengths, and what to study next.
class ReportSummary(BaseModel):
    summary: str = Field(description="Two or three sentences on how the interview went")
    strengths: list[str] = Field(description="Up to 3 things the candidate did well")
    improve: list[str] = Field(description="Up to 3 things to study next")
