from typing import Annotated, TypedDict


def merge(old, new):
    """For values that several agents write at the same time: keep everyone's, by agent id."""
    merged = dict(old or {})
    merged.update(new or {})
    return merged


class BankState(TypedDict):
    """Everything the panel graph remembers. The comment above each group says which step sets it.

    TypedDict only lists the keys and what kind of value each holds: the state is a normal dict.
    Annotated[dict, merge] is a note for LangGraph: when several steps write that key at the same time
    (the agents run in parallel), combine their values with merge() instead of keeping only the last one.
    """

    # Set by the caller: graph.stream({...})
    bank_id: str
    inputs: dict  # company, position, interview_type, level, topics, jd, resume, documents
    agent_ids: list[str]  # the agents on the panel (review_plan may take some off)
    review: bool  # review mode: pause for the human at review_plan and review_verdict
    revisions: int  # 0, or 1 once the judge has sent an agent back

    # Set by coordinator (briefs can be edited by you in review_plan)
    plan: str
    briefs: dict  # {agent_id: what this agent should cover}

    # Set by agent (all at the same time) and by revise
    drafts: Annotated[dict, merge]  # {agent_id: [question, ...]}
    research: Annotated[dict, merge]  # {agent_id: [passage, ...]} found with the document search tool
    failures: Annotated[dict, merge]  # {agent_id: error}, for agents that failed

    # Set by judge (and by you, in review_verdict)
    verdict: dict  # {"summary", "drop": [{"id", "reason"}], "scores": {question_id: {relevance, level, ...}}}
    send_back: dict  # {"agent", "note"} when the judge sends one agent back; {} once you block it
    restored: list[str]  # question ids you chose to keep although the judge dropped them

    # Set by assemble
    questions: list[dict]  # the final bank
    dropped: list[dict]


class AgentTask(TypedDict):
    """What each parallel agent step gets (sent by send_to_agents)."""

    agent_id: str
    brief: str
    inputs: dict
    bank_id: str
