"""The steps of the panel graph (see graph.py). Each step reads the state and returns what it changes.
The AI writes and judges the questions; the code checks what it says (ids, quotes, scores, problem ids).
In review mode, two steps pause the graph with interrupt() until you decide (human in the loop)."""
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import Send, interrupt

from services.coding.problems import PROBLEMS, find_problem
from services.llm import get_model
from services.question_bank.agents import find_agent
from services.question_bank.inputs import describe, source_of
from services.question_bank.prompts import (
    AGENT_PROMPT,
    CODING_EXTRA,
    CODING_PROBLEM,
    COORDINATOR_PROMPT,
    JUDGE_FINAL,
    JUDGE_PROMPT,
    NO_BRIEF,
    NO_PROBLEM,
    PASSAGES_EXTRA,
    REVISE_EXTRA,
    WHITEBOARD_BRIEF,
)
from services.question_bank.research import as_text, research
from services.question_bank.schemas import PanelPlan, QuestionSet, Verdict

RUBRIC = ["relevance", "level", "clarity", "answer"]  # what the judge scores, 1 to 5
DROP_AT = 2  # a question scoring this or lower on any of them is dropped
MAX_DROP_SHARE = 0.4  # the judge may remove at most this share of the questions


def coordinator(state):
    """START -> coordinator. Reads everything and writes each agent a brief, so they split the work."""
    agents = []
    roster = ""
    for agent_id in state["agent_ids"]:
        agent_info = find_agent(agent_id)
        agents.append(agent_info)
        roster += f"- {agent_info['id']} ({agent_info['name']}): {agent_info['focus']}\n"

    text = f"{describe(state['inputs'])}\n\nAgents:\n{roster}"
    plan = _ask(PanelPlan, COORDINATOR_PROMPT, text, "bank_coordinator", state["bank_id"])

    briefs = {}
    for brief in plan.briefs:
        if brief.agent in state["agent_ids"]:
            briefs[brief.agent] = brief.brief
    for agent_info in agents:
        if agent_info["id"] not in briefs:  # an agent the lead forgot still gets a brief
            briefs[agent_info["id"]] = f"Cover {agent_info['focus']}."
    return {"plan": plan.plan, "briefs": briefs}


def review_plan(state):
    """coordinator -> review_plan -> agents. In review mode the graph stops here (interrupt) until you
    approve the plan: you can edit any brief, or take an agent off the panel. Otherwise it just passes.
    Your decision (checked by the route): {"agents": [ids to keep], "briefs": {id: brief}}."""
    if not state.get("review"):
        return {}
    decision = interrupt({"kind": "plan", "plan": state["plan"], "briefs": state["briefs"]})

    agent_ids = []
    briefs = {}
    for agent_id in state["agent_ids"]:
        if agent_id not in decision["agents"]:
            continue  # you took this agent off the panel
        agent_ids.append(agent_id)
        edited = decision["briefs"].get(agent_id, "").strip()
        briefs[agent_id] = edited or state["briefs"][agent_id]
    if not agent_ids:
        return {}  # never an empty panel
    return {"agent_ids": agent_ids, "briefs": briefs}


def send_to_agents(state):
    """review_plan -> agent, once per agent on the panel. LangGraph runs them all at the same time."""
    tasks = []
    for agent_id in state["agent_ids"]:
        task = {"agent_id": agent_id, "brief": state["briefs"][agent_id],
                "inputs": state["inputs"], "bank_id": state["bank_id"]}
        tasks.append(Send("agent", task))
    return tasks


def agent(task):
    """One agent searches your documents (if you chose any), then writes its questions.
    If it fails, only it fails: the others carry on, and the judge works with what it gets."""
    agent_id = task["agent_id"]
    agent_info = find_agent(agent_id)
    try:
        passages = research(agent_info, task["brief"], task["inputs"], task["bank_id"])
    except Exception:
        passages = []  # a broken search is no reason to write nothing
    try:
        questions = write_set(agent_info, task["brief"], task["inputs"], task["bank_id"], passages)
    except Exception as error:
        return {"drafts": {agent_id: []}, "failures": {agent_id: f"{type(error).__name__}: {error}"}}
    return {"drafts": {agent_id: questions}, "research": {agent_id: passages}}


def judge(state):
    """agent (all of them) -> judge. An LLM judge scores every question on the rubric; the code drops the
    ones scoring DROP_AT or lower, or repeating an earlier one. It may also send one agent back, once."""
    final = state.get("revisions", 0) > 0
    prompt = JUDGE_PROMPT
    if final:
        prompt += JUDGE_FINAL
    try:
        verdict = _ask(Verdict, prompt, _bank_text(state), "bank_judge", state["bank_id"])
    except Exception:
        # No judge: keep every question rather than lose the bank.
        summary = "The judge could not check this bank, so every question was kept."
        return {"verdict": {"summary": summary, "drop": [], "scores": {}}}

    drafts = _all_drafts(state)  # question id -> (agent id, draft), in panel order
    cards, scores = _read_scores(verdict, drafts)
    drops = _decide_drops(drafts, cards, scores, state.get("restored", []))

    result = {"verdict": {"summary": verdict.summary, "drop": drops, "scores": scores}}
    agent_id = verdict.send_back_agent.strip()
    note = verdict.send_back_note.strip()
    if not final and note and state["drafts"].get(agent_id):
        result["send_back"] = {"agent": agent_id, "note": note}
    return result


def _read_scores(verdict, drafts):
    """The judge's score card for each real question (unknown ids are ignored), every score kept
    between 1 and 5. Returns (cards, scores), both by question id."""
    cards = {}
    scores = {}
    for card in verdict.scores:
        if card.id in drafts:
            cards[card.id] = card
            scores[card.id] = {
                "relevance": _one_to_five(card.relevance),
                "level": _one_to_five(card.level),
                "clarity": _one_to_five(card.clarity),
                "answer": _one_to_five(card.answer),
            }
    return cards, scores


def _decide_drops(drafts, cards, scores, restored):
    """The code, not the AI, decides what to drop: a repeat of an earlier question, or any score of
    DROP_AT or lower. Questions you chose to keep (restored) are never dropped."""
    drops = []
    earlier = []  # the questions before this one, to spot repeats
    for qid in drafts:
        agent_id, draft = drafts[qid]
        card = cards.get(qid)
        if card is not None and qid not in restored:
            reason = _drop_reason(card, scores[qid], earlier)
            if reason:
                drops.append({
                    "id": qid,
                    "agent": agent_id,
                    "question": draft["question"],
                    "reason": reason,
                    "scores": scores[qid],
                    "repeat": card.repeat_of in earlier,
                })
        earlier.append(qid)

    # The judge may not empty the bank: past the limit, repeats count first (they are certain), then the
    # lowest-scoring drops. (The judge eval found repeats being cut here before.)
    max_drops = int(len(drafts) * MAX_DROP_SHARE)
    drops.sort(key=_drop_order)
    return drops[:max_drops]


def review_verdict(state):
    """judge -> review_verdict. In review mode the graph stops here until you decide: allow or block the
    judge's send-back (and edit its note), and keep any question it dropped. Otherwise it just passes.
    Your decision (checked by the route): {"allow_send_back": bool, "send_back_note": text, "restore": [ids]}."""
    if not state.get("review"):
        return {}
    send_back = state.get("send_back")
    if state.get("revisions", 0) > 0:
        send_back = None  # an agent was already sent back once
    decision = interrupt({
        "kind": "verdict",
        "summary": state["verdict"]["summary"],
        "send_back": send_back or None,
        "drops": state["verdict"]["drop"],
    })

    result = {}
    rewriting = ""  # the agent that rewrites its set, if you allow the send-back
    if send_back:
        if decision["allow_send_back"]:
            note = decision["send_back_note"] or send_back["note"]
            result["send_back"] = {"agent": send_back["agent"], "note": note}
            rewriting = send_back["agent"]
        else:
            result["send_back"] = {}  # blocked: no rewrite

    # Keep the questions you picked (but not the rewriting agent's: its set is about to change).
    keep = []
    for qid in decision["restore"]:
        if rewriting and qid.startswith(rewriting + "-"):
            continue
        keep.append(qid)
    if keep:
        drops = []
        for drop in state["verdict"]["drop"]:
            if drop["id"] not in keep:
                drops.append(drop)
        result["verdict"] = {"summary": state["verdict"]["summary"], "drop": drops,
                             "scores": state["verdict"]["scores"]}
        result["restored"] = state.get("restored", []) + keep
    return result


def after_review(state):
    """review_verdict -> revise (if an agent was sent back, only the first time) or -> assemble."""
    if state.get("send_back") and state.get("revisions", 0) == 0:
        return "revise"
    return "assemble"


def revise(state):
    """revise -> judge. The agent sent back writes its set again, with the judge's note."""
    agent_id = state["send_back"]["agent"]
    passages = state.get("research", {}).get(agent_id, [])
    try:
        questions = write_set(find_agent(agent_id), state["briefs"][agent_id], state["inputs"], state["bank_id"],
                              passages, note=state["send_back"]["note"], previous=state["drafts"][agent_id])
    except Exception:
        return {"revisions": 1}  # keep its first set
    return {"drafts": {agent_id: questions}, "revisions": 1}


def assemble(state):
    """review_verdict -> assemble -> END. The final bank: every question kept, checked by code."""
    verdict = state["verdict"]
    drop_reasons = {}
    for drop in verdict["drop"]:
        drop_reasons[drop["id"]] = drop["reason"]
    restored = state.get("restored", [])

    questions = []
    dropped = []
    problems_used = []
    for agent_id in state["agent_ids"]:
        agent_info = find_agent(agent_id)
        passages = state.get("research", {}).get(agent_id, [])
        for qid, draft in _with_ids(agent_id, state["drafts"]):
            question = _finish(draft, agent_info, qid, state["inputs"], passages)
            scores = verdict["scores"].get(qid)

            if question is None or question["problem_id"] in problems_used:
                reason = "Not one of the tested coding problems, or picked twice."
            else:
                reason = drop_reasons.get(qid)
            if reason:
                dropped.append({"id": qid, "agent": agent_id, "question": draft["question"],
                                "reason": reason, "scores": scores})
                continue

            if question["problem_id"]:
                problems_used.append(question["problem_id"])
            question["scores"] = scores
            question["restored"] = qid in restored
            questions.append(question)

    return {"questions": questions, "dropped": dropped}


def write_set(agent_info, brief, inputs, bank_id, passages=(), note="", previous=None):
    """Asks one agent for its questions: the first time, or again with the judge's note."""
    extra = ""
    if agent_info["makes"] == "coding":
        extra += CODING_EXTRA.format(problems=_problem_list())
    if passages:
        extra += PASSAGES_EXTRA.format(passages=as_text(passages))
    if note:
        extra += REVISE_EXTRA.format(note=note, previous=_list(previous))

    brief_rule = NO_BRIEF
    if agent_info["makes"] == "whiteboard":
        brief_rule = WHITEBOARD_BRIEF
    problem_rule = NO_PROBLEM
    if agent_info["makes"] == "coding":
        problem_rule = CODING_PROBLEM

    system = AGENT_PROMPT.format(name=agent_info["name"], focus=agent_info["focus"], count=agent_info["count"],
                                 level=inputs["level"], brief_rule=brief_rule, problem_rule=problem_rule, extra=extra)
    text = f"Brief from the panel lead: {brief}\n\n{describe(inputs)}"
    result = _ask(QuestionSet, system, text, f"bank_agent_{agent_info['id']}", bank_id)

    questions = []
    for question in result.questions[: agent_info["count"]]:
        questions.append(question.model_dump())
    return questions


def _finish(draft, agent_info, qid, inputs, passages):
    """One draft as a bank question. None for a coding pick that isn't one of our tested problems."""
    source, source_detail = source_of(draft["based_on"], inputs, passages)
    key_points = []
    for point in draft["key_points"][:5]:
        if point.strip():
            key_points.append(point.strip())

    question = {
        "id": qid,
        "agent": agent_info["id"],
        "type": agent_info["makes"],  # the code decides the type, not the AI
        "question": draft["question"].strip(),
        "detail": "",
        "key_points": key_points,
        "difficulty": draft["difficulty"],
        "based_on": "",  # only shown when the words are really in what it quotes
        "source": source,
        "source_detail": source_detail,
        "problem_id": "",
    }
    if source:
        question["based_on"] = draft["based_on"].strip()
    if agent_info["makes"] == "whiteboard":
        question["detail"] = draft["brief"].strip()  # the scale the design must handle

    if agent_info["makes"] == "coding":
        problem = find_problem(draft["problem_id"].strip())
        if problem is None:
            return None
        question["question"] = problem["title"]
        question["detail"] = draft["question"].strip()  # why it fits the role
        question["key_points"] = [f"Best: {problem['best']}"] + key_points[:4]
        question["difficulty"] = problem["difficulty"]
        question["problem_id"] = problem["id"]
    return question


def _drop_reason(card, score, earlier_ids):
    """Why the code drops a question, or "" to keep it."""
    if card.repeat_of in earlier_ids:
        return f"Repeats {card.repeat_of}."
    weakest = RUBRIC[0]
    for name in RUBRIC:
        if score[name] < score[weakest]:
            weakest = name
    if score[weakest] <= DROP_AT:
        return f"Low {weakest} ({score[weakest]}/5): {card.reason}"
    return ""


def _drop_order(drop):
    """Which drops count first when there are too many: repeats, then the lowest total score."""
    if drop["repeat"]:
        return 0
    return sum(drop["scores"].values())


def _one_to_five(number):
    """The score kept between 1 and 5, whatever number the AI sent."""
    return min(5, max(1, number))


def _ask(schema, system, text, step, bank_id):
    """One AI call whose answer comes back in the shape of `schema`, logged in AI traces under `step`."""
    model = get_model().with_structured_output(schema)
    return model.invoke(
        [SystemMessage(system), HumanMessage(text)],
        config={"metadata": {"step": step, "thread_id": bank_id}},
    )


def _with_ids(agent_id, drafts):
    """An agent's questions with their ids: [("technical-1", question), ("technical-2", question), ...]"""
    numbered = []
    for number, draft in enumerate(drafts.get(agent_id, []), start=1):
        numbered.append((f"{agent_id}-{number}", draft))
    return numbered


def _all_drafts(state):
    """Every draft on the panel: {question id: (agent id, draft)}, in panel order."""
    drafts = {}
    for agent_id in state["agent_ids"]:
        for qid, draft in _with_ids(agent_id, state["drafts"]):
            drafts[qid] = (agent_id, draft)
    return drafts


def _bank_text(state):
    """Every draft question, by id, for the judge."""
    inputs = state["inputs"]
    lines = [
        f"Role: {inputs.get('position') or 'not given'} at {inputs.get('company') or 'not given'}, "
        f"level {inputs['level']}, interview type {inputs['interview_type']}",
        "",
    ]
    for agent_id in state["agent_ids"]:
        lines.append(f"Agent {agent_id}, brief: {state['briefs'].get(agent_id, '')}")
        for qid, draft in _with_ids(agent_id, state["drafts"]):
            key_points = "; ".join(draft["key_points"])
            lines.append(f"[{qid}] ({draft['difficulty']}) {draft['question']} | key points: {key_points}")
        lines.append("")
    return "\n".join(lines)


def _problem_list():
    """The tested coding problems, one per line, for the Coding agent's prompt."""
    lines = []
    for problem in PROBLEMS:
        lines.append(f"- {problem['id']}: {problem['title']} ({problem['difficulty']}, {problem['topic']})")
    return "\n".join(lines)


def _list(drafts):
    """An agent's first set of questions as lines, for its rewrite prompt."""
    lines = []
    for draft in drafts or []:
        lines.append(f"- {draft['question']}")
    return "\n".join(lines)
