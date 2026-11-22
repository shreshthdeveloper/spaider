from typing import TypedDict


class InterviewState(TypedDict):
    """Everything the interview remembers between steps. (TypedDict only lists the keys: it is a normal dict.)

    The comment above each group says which code sets those values.
    """

    # Set by the caller: graph.invoke({"topic": ..., "num_questions": ...})
    topic: str                  # the topic or job description
    num_questions: int          # how many main questions to ask
    difficulty: str             # "easy", "medium", "hard" or "mixed"
    max_follow_ups: int         # follow-ups allowed per main question
    intro: str                  # Bella's greeting, said before the first question (fixed words, see interview_service)

    # Set by plan_questions
    questions: list[dict]       # the plan: [{"question": ..., "key_points": [...]}]
    results: list[dict]         # every graded answer (starts empty; grade adds to it)

    # Set by plan_questions, then changed by follow_up and next_question
    index: int                  # which planned question we are on (0, 1, 2...)
    current_question: str       # what is being asked now: a main question or a follow-up
    current_points: list[str]   # the key points the current question should cover
    follow_ups: int             # follow-ups already asked for the current main question

    # Set by ask
    answer: str                 # the candidate's latest answer

    # Set by grade
    last_grade: dict            # the grade of the latest answer

    # Set by write_report
    report: dict                # the final report

    ended: bool                 # True when the candidate pressed "End interview"

