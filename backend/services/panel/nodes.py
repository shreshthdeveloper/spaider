"""The steps (nodes) of the panel interview, in the order they run. graph.py draws how they connect.

Every node receives the state (a dict) and returns ONLY the keys it changes. The listen and verdict steps
run once per panelist, all at the same time: they receive a small task (state.py) instead of the state.
"""
import math

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import Send, interrupt

from services.interview.nodes import check_answer
from services.llm import get_model
from services.panel.prompts import BRIEF_PROMPT, DEBRIEF_PROMPT, LISTEN_PROMPT, MODERATOR_PROMPT, VERDICT_PROMPT
from services.panel.schemas import ModeratorChoice, PanelBrief, PanelDebrief, PanelNote, PanelVerdict

MAX_TEXT = 6000  # characters of the JD, and of the resume, that the panel reads
HIRE = ["strong hire", "hire"]
BACKUP_POINTS = ["A specific example from their own work", "A clear reason for their choice"]


# ----------------------------------------------------------------------------- 1. brief
def brief(state):
    """Runs once, first. The panel reads the role, JD and resume and splits the interview: every panelist
    gets their own questions, on their own focus (one spare each, so the moderator has a choice).

    Reads:   inputs, panel, num_questions
    Returns: plan, and the first question (asked by the first panelist)
    Next:    ask
    """
    per_panelist = math.ceil(state["num_questions"] / len(state["panel"])) + 1
    writer = get_model().with_structured_output(PanelBrief)
    answer = writer.invoke([SystemMessage(BRIEF_PROMPT), HumanMessage(_brief_text(state, per_panelist))])

    plan = {}
    asked = {}
    for panelist in state["panel"]:
        plan[panelist["id"]] = []
        asked[panelist["id"]] = 0
    for written in answer.plans:
        if written.panelist not in plan:
            continue  # an id the AI made up
        for question in written.questions[:per_panelist]:
            plan[written.panelist].append({"question": question.question, "key_points": question.key_points})

    first = _next_main_speaker(state["panel"], plan, asked, state["num_questions"])
    if first is None:
        raise ValueError("The panel wrote no questions")
    turn = _main_question(first, plan, asked, "Opens the interview.")
    asked[first] = 1
    return {"plan": plan, "asked": asked, "turn": turn, "follow_ups": 0}


# ----------------------------------------------------------------------------- 2. ask
def ask(state):
    """Shows the current question and pauses the whole graph until you answer.

    Pauses:  interrupt() stops here and gives the question to the caller. When the caller resumes with
             Command(resume=reply), this function starts again from its first line, and this time
             interrupt() RETURNS the reply. So nothing may run before interrupt().
    Returns: the question and your answer, added to the transcript
    Next:    after_ask() chooses grade, or the verdicts if you pressed End
    """
    turn = state["turn"]
    reply = interrupt({
        "speaker": turn["speaker"],
        "kind": turn["kind"],
        "question": turn["question"],
        "reason": turn["reason"],
        "number": _main_asked(state["asked"]),
        "total": state["num_questions"],
    })
    if reply["action"] == "end":
        return {"ended": True}
    said = [
        {"speaker": turn["speaker"], "kind": turn["kind"], "text": turn["question"]},
        {"speaker": "you", "kind": "answer", "text": reply["text"]},
    ]
    return {"answer": reply["text"], "transcript": said}


def after_ask(state):
    """Not a node: chooses what runs after ask. Grade your answer, or, if you pressed End, go to the
    verdicts (or straight to the report when nothing was answered)."""
    if not state.get("ended"):
        return "grade"
    if not state["results"]:
        return "debrief"
    return send_to_verdicts(state)


# ----------------------------------------------------------------------------- 3. grade
def grade(state):
    """The panelist who asked grades your answer against their key points, with the mock interview's judge
    (the AI quotes your answer, code checks the quotes and sets the score).

    Reads:   turn, answer, results
    Returns: one more result
    Next:    listen, once per panelist (send_to_listeners)
    """
    turn = state["turn"]
    checked = check_answer(turn["question"], turn["key_points"], state["answer"])
    result = {
        "turn": len(state["results"]),  # 0 for the first answer, 1 for the next...
        "speaker": turn["speaker"],
        "kind": turn["kind"],
        "question": turn["question"],
        "answer": state["answer"],
        "score": checked["score"],
        "covered": checked["covered"],
        "missed": checked["missed"],
        "feedback": checked["feedback"],
    }
    return {"results": [result]}


def send_to_listeners(state):
    """Not a node: grade -> listen, once per panelist. LangGraph runs them all at the same time, and the
    moderator starts only when every panelist has written their note."""
    tasks = []
    for panelist in state["panel"]:
        task = {"panelist": panelist, "inputs": state["inputs"], "transcript": state["transcript"], "result": state["results"][-1]}
        tasks.append(Send("listen", task))
    return tasks


# ----------------------------------------------------------------------------- 4. listen (all panelists at once)
def listen(task):
    """One panelist reads the latest answer and writes a private note for the others: what they noticed, and
    a follow-up question if they want to ask one. These notes are how the panelists talk to each other.
    If one panelist's note fails, the others carry on without it."""
    panelist = task["panelist"]
    note = {"turn": task["result"]["turn"], "by": panelist["id"], "note": "", "follow_up": "", "follow_up_points": []}
    try:
        writer = get_model().with_structured_output(PanelNote)
        written = writer.invoke([SystemMessage(_persona(LISTEN_PROMPT, panelist)), HumanMessage(_listen_text(task))])
    except Exception:
        return {"notes": [note]}
    note["note"] = written.note
    note["follow_up"] = written.follow_up.strip()
    if note["follow_up"]:
        note["follow_up_points"] = written.follow_up_points[:3]
    return {"notes": [note]}


# ----------------------------------------------------------------------------- 5. moderator
def moderator(state):
    """Decides what happens after every answer. Plain code first works out what is allowed:
      - a follow-up, if a panelist asked for one and this main question has follow-ups left
      - a new main question, if the panel has questions left (the panelist who asked fewest goes next)
      - otherwise, the end
    Only when there is a real choice does the AI moderator pick, with a reason. Code checks its pick.

    Reads:   results, notes, asked, follow_ups, plan
    Returns: the moderator's decision, and the next turn
    Next:    after_moderator() chooses ask, or the verdicts
    """
    last = state["results"][-1]
    wishes = _follow_up_wishes(state["notes"], last["turn"])
    can_follow_up = len(wishes) > 0 and state["follow_ups"] < state["max_follow_ups"]
    next_speaker = _next_main_speaker(state["panel"], state["plan"], state["asked"], state["num_questions"])

    if not can_follow_up and next_speaker is None:
        choice = {"action": "wrap_up", "speaker": "", "reason": "Every main question has been asked."}
    elif not can_follow_up:
        choice = {"action": "new_question", "speaker": next_speaker, "reason": _move_on_reason(wishes)}
    else:
        choice = _ask_moderator(state, last, wishes, next_speaker)

    decision = {"turn": last["turn"], "action": choice["action"], "speaker": choice["speaker"], "reason": choice["reason"]}
    update = {"decisions": [decision]}
    if choice["action"] == "follow_up":
        wish = _wish_of(wishes, choice["speaker"])
        points = wish["follow_up_points"] or last["missed"] or BACKUP_POINTS
        update["turn"] = {"speaker": wish["by"], "kind": "follow_up", "question": wish["follow_up"], "key_points": points, "reason": choice["reason"]}
        update["follow_ups"] = state["follow_ups"] + 1
    elif choice["action"] == "new_question":
        asked = dict(state["asked"])
        update["turn"] = _main_question(choice["speaker"], state["plan"], asked, choice["reason"])
        asked[choice["speaker"]] += 1
        update["asked"] = asked
        update["follow_ups"] = 0
    return update


def after_moderator(state):
    """Not a node: the next question, or the verdicts once the moderator wrapped up."""
    if state["decisions"][-1]["action"] == "wrap_up":
        return send_to_verdicts(state)
    return "ask"


def _ask_moderator(state, last, wishes, next_speaker):
    """The AI moderator's pick between the follow-ups the panelists want and (if any are left) a new main
    question. If it picks something that isn't allowed, code falls back to the first follow-up."""
    options = ""
    for wish in wishes:
        options += f"- follow_up by {wish['by']} ({_name(state, wish['by'])}): {wish['follow_up']}\n"
    if next_speaker is not None:
        options += f"- new_question: {_name(state, next_speaker)} asks their next main question\n"

    notes = ""
    for note in state["notes"]:
        if note["turn"] == last["turn"] and note["note"]:
            notes += f"- {_name(state, note['by'])}: {note['note']}\n"

    chooser = get_model().with_structured_output(ModeratorChoice)
    choice = chooser.invoke([
        SystemMessage(MODERATOR_PROMPT),
        HumanMessage(
            f"Question ({_name(state, last['speaker'])}): {last['question']}\n"
            f"<candidate_answer>\n{last['answer']}\n</candidate_answer>\n"
            f"Score: {last['score']}/5. Missed: {', '.join(last['missed']) or 'nothing'}\n\n"
            f"The panel's notes:\n{notes or '(none)'}\n"
            f"Options:\n{options}"
        ),
    ])

    if choice.action == "follow_up" and _wish_of(wishes, choice.speaker) is not None:
        return {"action": "follow_up", "speaker": choice.speaker, "reason": choice.reason}
    if choice.action == "new_question" and next_speaker is not None:
        return {"action": "new_question", "speaker": next_speaker, "reason": choice.reason}
    return {"action": "follow_up", "speaker": wishes[0]["by"], "reason": f"{_name(state, wishes[0]['by'])} wants to dig deeper."}


# ----------------------------------------------------------------------------- 6. verdict (all panelists at once)
def send_to_verdicts(state):
    """Not a node: -> verdict, once per panelist, all at the same time. The debrief waits for all of them."""
    tasks = []
    for panelist in state["panel"]:
        task = {"panelist": panelist, "inputs": state["inputs"], "results": state["results"], "notes": state["notes"]}
        tasks.append(Send("verdict", task))
    return tasks


def verdict(task):
    """One panelist's own decision on you, judged on their focus, with reasons."""
    panelist = task["panelist"]
    try:
        writer = get_model().with_structured_output(PanelVerdict)
        written = writer.invoke([SystemMessage(_persona(VERDICT_PROMPT, panelist)), HumanMessage(_verdict_text(task))])
    except Exception:
        return {"verdicts": [{"by": panelist["id"], "decision": "no decision", "reasons": ["This panelist's verdict failed."]}]}
    return {"verdicts": [{"by": panelist["id"], "decision": written.decision, "reasons": written.reasons[:3]}]}


# ----------------------------------------------------------------------------- 7. debrief
def debrief(state):
    """Runs once, last. The panel agrees on one decision: code counts the votes ("hire" needs at least half
    the panel), and the AI writes the summary. The overall score is the average of the main questions, as in
    the mock interview.

    Reads:   results, verdicts
    Returns: report
    Next:    END
    """
    results = state["results"]
    if not results:
        return {"report": {"overall": 0, "decision": "No decision", "votes": "", "summary": "The interview ended before any answer.",
                           "agreed": [], "disagreed": [], "improve": []}}

    hires = 0
    for vote in state["verdicts"]:
        if vote["decision"] in HIRE:
            hires += 1
    decision = "Hire" if state["verdicts"] and hires * 2 >= len(state["verdicts"]) else "No hire"

    writer = get_model().with_structured_output(PanelDebrief)
    summary = writer.invoke([SystemMessage(DEBRIEF_PROMPT), HumanMessage(_debrief_text(state, decision))])
    return {
        "report": {
            "overall": _average_main_score(results),
            "decision": decision,
            "votes": f"{hires} of {len(state['verdicts'])}",
            "summary": summary.summary,
            "agreed": summary.agreed[:3],
            "disagreed": summary.disagreed[:3],
            "improve": summary.improve[:3],
        }
    }


# ----------------------------------------------------------------------------- small helpers
def _main_question(speaker, plan, asked, reason):
    """The turn for this panelist's next planned main question."""
    planned = plan[speaker][asked[speaker]]
    return {"speaker": speaker, "kind": "question", "question": planned["question"], "key_points": planned["key_points"], "reason": reason}


def _next_main_speaker(panel, plan, asked, num_questions):
    """Who asks the next main question: the panelist who has asked the fewest so far and still has questions,
    in panel order. None when the panel has asked all its main questions."""
    if _main_asked(asked) >= num_questions:
        return None
    best = None
    for panelist in panel:
        speaker = panelist["id"]
        if asked[speaker] >= len(plan[speaker]):
            continue  # no questions left
        if best is None or asked[speaker] < asked[best]:
            best = speaker
    return best


def _main_asked(asked):
    """How many main questions the panel has asked so far."""
    total = 0
    for count in asked.values():
        total += count
    return total


def _follow_up_wishes(notes, turn):
    """The notes about this answer that ask for a follow-up."""
    wishes = []
    for note in notes:
        if note["turn"] == turn and note["follow_up"]:
            wishes.append(note)
    return wishes


def _wish_of(wishes, speaker):
    """This panelist's follow-up wish, or None."""
    for wish in wishes:
        if wish["by"] == speaker:
            return wish
    return None


def _move_on_reason(wishes):
    """Why the panel moves on without asking the AI moderator."""
    if wishes:
        return "Follow-ups for this question are used up, so on to the next one."
    return "Nobody needed a follow-up, so on to the next question."


def _name(state, panelist_id):
    """"Priya (Tech Lead)" for a panelist id."""
    for panelist in state["panel"]:
        if panelist["id"] == panelist_id:
            return f"{panelist['name']} ({panelist['title']})"
    return panelist_id


def _persona(prompt, panelist):
    """A prompt with the panelist's name, title and focus filled in."""
    return prompt.format(name=panelist["name"], title=panelist["title"], focus=panelist["focus"])


def _inputs_text(inputs):
    """The role, JD and resume as one block of text for the prompts."""
    text = f"Role: {inputs.get('role') or 'not given'}\n"
    text += f"Company: {inputs.get('company') or 'not given'}\n"
    text += f"Level: {inputs.get('level') or 'not given'}\n\n"
    text += f"Job description:\n{inputs.get('jd', '')[:MAX_TEXT] or '(not given)'}\n\n"
    text += f"Resume:\n{inputs.get('resume', '')[:MAX_TEXT] or '(not given)'}\n"
    if inputs.get("weak_lines"):
        text += "\nWeak resume lines (the candidate struggled to defend these):\n"
        for line in inputs["weak_lines"]:
            text += f"- {line}\n"
    return text


def _brief_text(state, per_panelist):
    """What the brief is given: the panelists, how many questions each, and the inputs."""
    text = f"Write {per_panelist} questions for each of these panelists:\n"
    for panelist in state["panel"]:
        text += f"- id: {panelist['id']} | {panelist['name']}, {panelist['title']} | focus: {panelist['focus']}\n"
    return text + "\n" + _inputs_text(state["inputs"])


def _transcript_text(transcript):
    """The conversation so far as plain lines ("Priya: ...", "Candidate: ...")."""
    text = ""
    for line in transcript:
        who = "Candidate" if line["speaker"] == "you" else line["speaker"]
        text += f"{who}: {line['text']}\n"
    return text


def _listen_text(task):
    """What a panelist reads before writing their note."""
    result = task["result"]
    return (
        f"The interview so far:\n{_transcript_text(task['transcript'][-12:])}\n"
        f"Latest question ({result['speaker']}): {result['question']}\n"
        f"<candidate_answer>\n{result['answer']}\n</candidate_answer>\n"
        f"The asker's grade: {result['score']}/5, missed: {', '.join(result['missed']) or 'nothing'}"
    )


def _verdict_text(task):
    """What a panelist reads before their verdict: every question, answer and score, and their own notes."""
    text = ""
    for result in task["results"]:
        label = "Follow-up" if result["kind"] == "follow_up" else "Question"
        text += f"{label} ({result['speaker']}): {result['question']}\n"
        text += f"Answer: {result['answer']}\nScore: {result['score']}/5\n\n"
    own_notes = ""
    for note in task["notes"]:
        if note["by"] == task["panelist"]["id"] and note["note"]:
            own_notes += f"- {note['note']}\n"
    return text + f"Your notes during the interview:\n{own_notes or '(none)'}"


def _debrief_text(state, decision):
    """What the debrief writer reads: the decision, every vote with its reasons, and the scores."""
    text = f"Decision (by vote): {decision}\n\nVotes:\n"
    for vote in state["verdicts"]:
        text += f"- {_name(state, vote['by'])}: {vote['decision']}. {' '.join(vote['reasons'])}\n"
    text += "\nAnswers:\n"
    for result in state["results"]:
        text += f"- {result['question']} -> {result['score']}/5\n"
    return text


def _average_main_score(results):
    """Average score of the main questions. Follow-ups are not counted."""
    scores = []
    for result in results:
        if result["kind"] == "question":
            scores.append(result["score"])
    if not scores:
        return 0
    return round(sum(scores) / len(scores), 1)
