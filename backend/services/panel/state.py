from operator import add
from typing import Annotated, TypedDict


class PanelState(TypedDict):
    """Everything the panel interview remembers. The comment above each group says which step sets it.

    TypedDict only lists the keys: the state is a normal dict. Annotated[list, add] is a note for LangGraph:
    when a step returns this key, ADD its items to the list instead of replacing the list. That is how all
    the panelists can write their notes at the same time without losing any.
    """

    # Set by the caller: graph.invoke({...})
    inputs: dict  # role, company, level, jd, resume, weak_lines (the weak lines from your Resume grind)
    panel: list[dict]  # the panelists, in order (see panelists.py)
    num_questions: int  # main questions for the whole panel
    max_follow_ups: int  # follow-ups allowed after each main question
    intros: list[dict]  # the round of introductions at the start: {"speaker", "voice", "text"} (panel_service.py)

    # Set by brief
    plan: dict  # {panelist id: [{"question", "key_points"}, ...]}

    # Set by brief (the first question), then by moderator
    turn: dict  # what is asked now: {"speaker", "kind": "question" | "follow_up", "question", "key_points", "reason"}
    asked: dict  # {panelist id: how many main questions they asked}
    follow_ups: int  # follow-ups asked since the last main question

    # Set by ask
    transcript: Annotated[list, add]  # everything said, in order: {"speaker": panelist id or "you", "kind", "text"}
    answer: str  # your latest answer
    ended: bool  # True when you pressed End

    # Set by grade
    results: Annotated[list, add]  # every graded answer: {"turn", "speaker", "kind", "question", "answer", "score", ...}

    # Set by listen (every panelist at the same time) and by moderator
    notes: Annotated[list, add]  # private notes: {"turn", "by", "note", "follow_up", "follow_up_points"}
    decisions: Annotated[list, add]  # the moderator's choice after each answer: {"turn", "action", "speaker", "reason"}

    # Set by verdict (every panelist at the same time), then by debrief
    verdicts: Annotated[list, add]  # {"by", "decision", "reasons"}
    report: dict


class ListenTask(TypedDict):
    """What each panelist's listen step gets (sent by send_to_listeners)."""

    panelist: dict
    inputs: dict
    transcript: list
    result: dict  # the grade of the answer they just heard


class VerdictTask(TypedDict):
    """What each panelist's verdict step gets (sent by send_to_verdicts)."""

    panelist: dict
    inputs: dict
    results: list
    notes: list
