"""The steps (nodes) of the interview.

Every node is a plain function:
  - it receives the whole state (a dict),
  - it returns ONLY the keys it changes,
  - LangGraph merges those keys into the state, then follows the edge to the next node.

The ORDER of the steps is not decided here. It is drawn in graph.py.
This file is laid out in the order the steps run: 1, 2, 3, 4, then 5a / 5b / 5c.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import interrupt

from services.interview.prompts import DIFFICULTY, FOLLOW_UP_PROMPT, JUDGE_PROMPT, PLAN_PROMPT, REPORT_PROMPT
from services.interview.schemas import FollowUp, Grade, InterviewPlan, ReportSummary
from services.llm import get_model
from services.text import simplify

GOOD_SCORE = 4       # a score of 4 or 5 (out of 5) needs no follow-up
MAX_FOLLOW_UPS = 1   # follow-ups allowed per main question, unless the interview sets its own


# ----------------------------------------------------------------------------- 1. plan
def plan_questions(state):
    """Runs once, first (START -> plan_questions).

    Reads:   topic, num_questions, difficulty  (they come from graph.invoke({...}) in the caller),
             and questions, if the caller already has them (picked from a question bank)
    Returns: the plan, and sets up the first question
    Next:    ask
    """
    if state.get("questions"):  # already picked: no need to ask the AI for a plan
        questions = state["questions"][: state["num_questions"]]
    else:
        difficulty = DIFFICULTY[state.get("difficulty", "mixed")]
        planner = get_model().with_structured_output(InterviewPlan)
        plan = planner.invoke([
            SystemMessage(PLAN_PROMPT),
            HumanMessage(
                f"Topic or job description:\n{state['topic']}\n\n"
                f"Number of questions: {state['num_questions']}\nDifficulty: {difficulty}"
            ),
        ])
        questions = []
        for planned in plan.questions[: state["num_questions"]]:
            questions.append({"question": planned.question, "key_points": planned.key_points})
    if not questions:
        raise ValueError("The planner returned no questions")

    first = questions[0]
    return {
        "questions": questions,
        "index": 0,
        "current_question": first["question"],
        "current_points": first["key_points"],
        "follow_ups": 0,
        "results": [],
    }


# ----------------------------------------------------------------------------- 2. ask
def ask(state):
    """Runs before EVERY answer: each main question and each follow-up.

    Reads:   current_question, index, questions, follow_ups
    Pauses:  interrupt() stops the whole graph here and gives the question to the caller.
             Later the caller resumes with Command(resume=reply). This function then starts again
             from its first line, and this time interrupt() RETURNS the reply instead of stopping.
             The reply is {"action": "answer", "text": "..."} or {"action": "end"}.
    Returns: answer and ended
    Next:    after_ask() picks grade, or write_report if the candidate ended the interview
    """
    # Nothing may run before interrupt(), because this function runs again on resume.
    reply = interrupt({
        "question": state["current_question"],
        "number": state["index"] + 1,
        "total": len(state["questions"]),
        "is_follow_up": state["follow_ups"] > 0,
    })

    if reply["action"] == "end":
        return {"ended": True}
    return {"answer": reply["text"], "ended": False}


# ----------------------------------------------------------------------------- 2b. after ask
def after_ask(state):
    """Not a node. graph.py calls it right after ask: an answer goes to grade, "end" goes to the report."""
    if state["ended"]:
        return "write_report"
    return "grade"


# ----------------------------------------------------------------------------- 3. grade
def grade(state):
    """Runs after every answer.

    Reads:   answer, current_question, current_points, follow_ups, results
    Returns: last_grade (this answer's grade) and results (every grade so far)
    Next:    route() is called and picks follow_up, next_question or write_report
    """
    answer = state["answer"]
    points = state["current_points"]

    # The LLM judge says, for each key point: covered or not, plus a quote from the answer.
    judge = get_model().with_structured_output(Grade)
    result = judge.invoke([
        SystemMessage(JUDGE_PROMPT),
        HumanMessage(
            f"Question: {state['current_question']}\n\n"
            f"Key points:\n{_numbered(points)}\n"
            f"<candidate_answer>\n{answer}\n</candidate_answer>"
        ),
    ])

    # Code checks every quote and computes the score. The LLM never sets the score.
    covered = []
    missed = []
    for i, point in enumerate(points):
        if i < len(result.checks) and _is_covered(result.checks[i], answer):
            covered.append(point)
        else:
            missed.append(point)

    score = round(5 * len(covered) / len(points)) if points else 0
    graded = {
        "question": state["current_question"],
        "answer": answer,
        "score": score,
        "covered": covered,
        "missed": missed,
        "feedback": result.feedback,
        "is_follow_up": state["follow_ups"] > 0,
    }
    return {"last_grade": graded, "results": state["results"] + [graded]}


# ----------------------------------------------------------------------------- 4. route
def route(state):
    """Not a node. graph.py calls it right after grade, to choose the next node.

    Plain code decides, never the LLM. It returns the NAME of the next node.
    """
    next_node, _reason = decide_next(state)
    return next_node


def decide_next(state):
    """route()'s choice, and the reason in words: ("follow_up", "The score was 2/5..."). The Interview X-ray
    (xray.py) shows the reason next to each grade."""
    last = state["last_grade"]
    weak_answer = last["score"] < GOOD_SCORE and len(last["missed"]) > 0
    allowed = state.get("max_follow_ups", MAX_FOLLOW_UPS)  # .get(): interviews saved before this setting existed
    score = f"The score was {last['score']}/5"

    if weak_answer and state["follow_ups"] < allowed:
        return "follow_up", f"{score} (under {GOOD_SCORE}) with key points missed, and a follow-up is still allowed."
    if weak_answer:
        score += f" with key points missed, but the {allowed} follow-up(s) allowed are used up"
    else:
        score += " (good enough)"
    if state["index"] + 1 < len(state["questions"]):
        return "next_question", f"{score}, so on to question {state['index'] + 2}."
    return "write_report", f"{score}, and that was the last question: time for the report."


# ----------------------------------------------------------------------------- 5a. follow-up
def follow_up(state):
    """Runs when route() says: the answer was weak and a follow-up is still allowed.

    Reads:   last_grade, follow_ups
    Returns: a new current_question that targets only the missed points
    Next:    ask
    """
    last = state["last_grade"]
    missed = "\n".join(last["missed"])

    writer = get_model().with_structured_output(FollowUp)
    result = writer.invoke([
        SystemMessage(FOLLOW_UP_PROMPT),
        HumanMessage(f"Question: {last['question']}\n\nCandidate's answer: {last['answer']}\n\nMissed points:\n{missed}"),
    ])
    return {
        "current_question": result.question,
        "current_points": last["missed"],
        "follow_ups": state["follow_ups"] + 1,
    }


# ----------------------------------------------------------------------------- 5b. next question
def next_question(state):
    """Runs when route() says: move on to the next planned question. No LLM call.

    Reads:   index, questions
    Returns: the next planned question, with follow-ups reset to 0
    Next:    ask
    """
    index = state["index"] + 1
    planned = state["questions"][index]
    return {
        "index": index,
        "current_question": planned["question"],
        "current_points": planned["key_points"],
        "follow_ups": 0,
    }


# ----------------------------------------------------------------------------- 5c. report
def write_report(state):
    """Runs once, last, when route() says there is nothing left to ask.

    Reads:   results
    Returns: report
    Next:    END, so graph.invoke() returns the final state to the caller
    """
    results = state["results"]
    if not results:
        return {"report": {"overall": 0, "summary": "The interview ended before any answer.", "strengths": [], "improve": []}}

    writer = get_model().with_structured_output(ReportSummary)
    summary = writer.invoke([SystemMessage(REPORT_PROMPT), HumanMessage(_results_as_text(results))])

    return {
        "report": {
            "overall": _average_main_score(results),
            "summary": summary.summary,
            "strengths": summary.strengths,
            "improve": summary.improve,
        }
    }


# ----------------------------------------------------------------------------- small helpers
def _numbered(points):
    """["a", "b"] -> "1. a\\n2. b\\n" """
    text = ""
    for number, point in enumerate(points, start=1):
        text += f"{number}. {point}\n"
    return text


def _is_covered(check, answer):
    """True only if the judge said 'covered' AND its quote really appears in the answer."""
    quote = simplify(check.evidence)
    return check.covered and quote != "" and quote in simplify(answer)


def _average_main_score(results):
    """Average score of the main questions. Follow-ups are not counted."""
    scores = []
    for r in results:
        if not r["is_follow_up"]:
            scores.append(r["score"])
    if not scores:
        return 0
    return round(sum(scores) / len(scores), 1)


def _results_as_text(results):
    """Every graded answer as plain text, for the report writer."""
    text = ""
    for r in results:
        kind = "Follow-up" if r["is_follow_up"] else "Question"
        missed = ", ".join(r["missed"]) if r["missed"] else "nothing"
        text += f"{kind}: {r['question']}\n"
        text += f"Answer: {r['answer']}\n"
        text += f"Score: {r['score']}/5\n"
        text += f"Missed: {missed}\n\n"
    return text
