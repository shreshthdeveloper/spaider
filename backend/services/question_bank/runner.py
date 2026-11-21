"""Runs a panel in the background, and writes its progress into the bank as it happens.
The browser polls GET /question-banks/<id> and draws bank.steps as the pipeline.

Each run is its own LangGraph thread ("<bank id>-<run number>"), saved by the checkpointer. So in review
mode the graph can stop at an interrupt (the bank's status becomes "needs_you"), and later carry on from
exactly that point with your decision (resume_run)."""
import logging
import threading
from datetime import datetime

from langgraph.types import Command

from models.chat import utc_now
from models.question_bank import find_bank
from services.question_bank.agents import find_agent
from services.question_bank.graph import get_bank_graph

log = logging.getLogger(__name__)

# What the "You" card says while the panel waits for you.
ASK = {"plan": "Approve the plan", "verdict": "Review the judge's call"}


def start_run(bank):
    """Saves a fresh pipeline and starts the panel on its own thread, so the request returns at once."""
    bank.runs = bank.runs + 1
    bank.status = "running"
    bank.error = ""
    bank.plan = ""
    bank.summary = ""
    bank.pending = {}
    bank.questions = []
    bank.dropped = []
    bank.steps = _first_steps(bank)
    bank.updated_at = utc_now()
    bank.save()
    _run_in_background(bank, None)


def resume_run(bank, decision):
    """You answered the panel's question: note it on the pipeline, and let the graph carry on."""
    steps = _load_steps(bank)
    you = steps[_you_step_id(bank.pending["kind"])]
    _finish(you, note=_decision_note(bank.pending, decision, steps), label="your review")
    bank.pending = {}
    bank.status = "running"
    _save(bank, steps)
    _run_in_background(bank, Command(resume=decision))


def run_panel(bank_id, command=None):
    """Runs the graph (from the start, or on from a pause) and records every step on the pipeline."""
    bank = find_bank(bank_id)
    steps = _load_steps(bank)
    config = {"configurable": {"thread_id": f"{bank_id}-{bank.runs}"}}
    if command is None:
        graph_input = {"bank_id": bank_id, "inputs": bank.inputs, "agent_ids": bank.agent_ids,
                       "review": bank.review, "revisions": 0}
    else:
        graph_input = command  # Command(resume=your decision) carries on from the pause

    try:
        # "updates": one item per finished step, as soon as it finishes (the parallel agents arrive one
        # by one). "custom": the agents' document searches, sent while they work (see research.py).
        for mode, chunk in get_bank_graph().stream(graph_input, config, stream_mode=["updates", "custom"]):
            if mode == "custom":
                _record_search(steps, chunk)
            else:
                for node, output in chunk.items():
                    _record(bank, steps, node, output)
            _save(bank, steps)
        if bank.pending:
            bank.status = "needs_you"
        else:
            bank.status = "done"
    except Exception as error:
        log.exception("Question bank %s failed", bank_id)
        bank.status = "failed"
        bank.error = f"{type(error).__name__}: {error}"
        for step in steps.values():
            if step["status"] in ("thinking", "revising"):
                _fail(step, "Stopped: the panel failed.")
    _save(bank, steps)


# ---------------------------------------------------------------- one finished step -> the pipeline

def _record(bank, steps, node, output):
    """One finished graph step -> what changes on the pipeline the browser draws."""
    if node == "__interrupt__":
        _paused(bank, steps, output[0].value)
    elif node == "coordinator":
        _after_coordinator(bank, steps, output)
    elif node == "review_plan":
        _after_review_plan(bank, steps, output or {})  # empty when it just passed through
    elif node == "agent":
        _after_agent(steps, output)
    elif node == "judge":
        _after_judge(bank, steps, output)
    elif node == "review_verdict":
        _after_review_verdict(steps, output or {})
    elif node == "revise":
        _after_revise(steps, output)
    elif node == "assemble":
        bank.questions = output["questions"]
        bank.dropped = output["dropped"]


def _paused(bank, steps, question):
    """The graph stopped at interrupt(): it is your turn."""
    bank.pending = question
    you = steps[_you_step_id(question["kind"])]
    _start(you, status="needs_you", message=ASK[question["kind"]])


def _after_coordinator(bank, steps, output):
    """The lead is done: save its plan and keep each agent's brief. (The agents start in _after_review_plan.)
    The lead is done: save its plan and keep each agent's brief. (The agents start in _after_review_plan.)"""
    bank.plan = output["plan"]
    _finish(steps["coordinator"], note=output["plan"], message="", label="plan")
    for agent_id, brief in output["briefs"].items():
        steps[f"agent:{agent_id}"]["brief"] = brief


def _after_review_plan(bank, steps, output):
    """The plan is approved (by you, or at once): the agents start. Agents you took off are skipped."""
    kept = output.get("agent_ids", bank.agent_ids)
    edited_briefs = output.get("briefs", {})
    for step in _agent_steps(steps):
        if step["agent"] in kept:
            step["brief"] = edited_briefs.get(step["agent"], step["brief"])
            _start(step, message=step["brief"])  # the lead's message to this agent
        else:
            step["status"] = "skipped"
            step["note"] = "Taken off the panel by you"


def _after_agent(steps, output):
    """An agent is done (or failed). When the last one finishes, the judge starts."""
    for agent_id, questions in output["drafts"].items():
        step = steps[f"agent:{agent_id}"]
        error = output.get("failures", {}).get(agent_id)
        if error:
            _fail(step, error)
        else:
            _finish(step, note=_count(questions), label="write")

    # when the last agent is done, the judge starts
    for step in _agent_steps(steps):
        if step["status"] not in ("done", "failed", "skipped"):
            return
    _start(steps["judge"], message="Scoring every question")


def _after_judge(bank, steps, output):
    """The judge finished a check. If it sends an agent back, that agent starts rewriting (in review mode,
    only once you allow it)."""
    judge = steps["judge"]
    bank.summary = output["verdict"]["summary"]
    label = "re-check" if judge["runs"] else "check"
    _finish(judge, note=bank.summary, message="", label=label)

    if output.get("send_back"):
        judge["sent_back"] = output["send_back"]
        if not bank.review:  # in review mode you decide first (see _after_review_verdict)
            _send_back(steps, output["send_back"])


def _after_review_verdict(steps, output):
    """You allowed or blocked the judge's send-back (nothing to do if there was none)."""
    if "send_back" not in output:
        return
    judge = steps["judge"]
    if output["send_back"]:
        judge["sent_back"] = output["send_back"]  # with your edits to the note
        _send_back(steps, output["send_back"])
    else:
        blocked = dict(judge["sent_back"])
        blocked["blocked"] = True
        judge["sent_back"] = blocked


def _after_revise(steps, output):
    """The agent that was sent back has rewritten its set, and the judge checks again."""
    for step in _agent_steps(steps):
        if step["status"] != "revising":
            continue
        questions = output.get("drafts", {}).get(step["agent"])
        if questions:
            note = f"Rewrote its set: {_count(questions)}"
        else:
            note = "Kept its first set"
        _finish(step, note=note, label="rewrite")
    _start(steps["judge"], message="Scoring the new set")


def _record_search(steps, event):
    """An agent searched your documents (a "custom" event from research.py)."""
    step = steps.get(f"agent:{event['agent']}")
    if step is not None:
        step["searches"] = step["searches"] + [{"query": event["query"], "found": event["found"]}]


def _send_back(steps, send_back):
    """The judge's message reaches the agent: it starts rewriting, and the judge waits for it."""
    agent = steps[f"agent:{send_back['agent']}"]
    _start(agent, status="revising", message=f"Judge: {send_back['note']}")
    judge = steps["judge"]
    judge["status"] = "waiting"
    judge["message"] = f"Waiting for {agent['name']} to rewrite"


def _decision_note(pending, decision, steps):
    """One line on what you decided, for the "You" card."""
    if pending["kind"] == "plan":
        parts = ["Approved"]
        edited = 0
        for agent_id, brief in decision["briefs"].items():
            if brief and brief != pending["briefs"].get(agent_id, "").strip():
                edited += 1
        if edited:
            parts.append(f"edited {_plural(edited, 'brief')}")
        removed = []
        for step in _agent_steps(steps):
            if step["agent"] not in decision["agents"]:
                removed.append(step["name"])
        if removed:
            parts.append(f"took {', '.join(removed)} off the panel")
        return ", ".join(parts) + "."

    parts = []
    if pending.get("send_back"):
        if decision["allow_send_back"]:
            parts.append("Allowed the send-back")
        else:
            parts.append("Blocked the send-back")
    if decision["restore"]:
        parts.append(f"kept {_plural(len(decision['restore']), 'dropped question')}")
    if not parts:
        return "Agreed with the judge."
    return ", ".join(parts) + "."


# ---------------------------------------------------------------- the steps themselves

def _first_steps(bank):
    """The cards of a fresh pipeline: the lead (thinking), the agents and the judge (waiting), and the You
    cards in review mode."""
    steps = [_step("coordinator", "coordinator", "Panel lead")]
    if bank.review:
        steps.append(_step("you:plan", "human", "You"))
    for agent_id in bank.agent_ids:
        steps.append(_step(f"agent:{agent_id}", "agent", _name(agent_id), agent_id))
    steps.append(_step("judge", "judge", "Judge"))
    if bank.review:
        steps.append(_step("you:review", "human", "You"))
    _start(steps[0], message="Reading your inputs")
    return steps


def _step(step_id, kind, name, agent=""):
    """One card on the pipeline.
    status: waiting | thinking | revising | needs_you | done | failed | skipped
    message: what it was told. note: what it did. runs: each time it worked, for the timeline.
    searches: the documents it searched."""
    return {
        "id": step_id,
        "kind": kind,
        "name": name,
        "agent": agent,
        "status": "waiting",
        "message": "",
        "note": "",
        "brief": "",
        "started_at": "",
        "ms": None,
        "runs": [],
        "searches": [],
    }


def _start(step, message="", status="thinking"):
    """A card starts working: its status, its message, and the time it started."""
    step["status"] = status
    step["message"] = message
    step["started_at"] = utc_now().isoformat()
    step["ms"] = None


def _finish(step, note="", message=None, label=""):
    """A card is done: its note, how long it took, and one more bar on the timeline."""
    step["status"] = "done"
    step["note"] = note
    step["ms"] = _ms_since(step["started_at"])
    step["runs"] = step["runs"] + [{"label": label, "start": step["started_at"], "ms": step["ms"]}]
    if message is not None:
        step["message"] = message


def _fail(step, error):
    """A card failed: the error, and a "failed" bar on the timeline."""
    step["status"] = "failed"
    step["note"] = error[:300]
    step["ms"] = _ms_since(step["started_at"])
    step["runs"] = step["runs"] + [{"label": "failed", "start": step["started_at"], "ms": step["ms"]}]


def _ms_since(started_at):
    """Milliseconds since a saved start time."""
    if not started_at:
        return None
    seconds = (utc_now() - datetime.fromisoformat(started_at)).total_seconds()
    return round(seconds * 1000)


def _load_steps(bank):
    """The bank's steps as plain dicts, by id (in pipeline order)."""
    steps = {}
    for step in bank.steps:
        steps[step["id"]] = dict(step)
    return steps


def _save(bank, steps):
    """Saves the pipeline (every card) into the bank."""
    # Save copies: MongoEngine only saves a field whose new value differs from the old one, and the
    # old value would otherwise be these same dicts (changed in place), so it would see no change.
    copies = []
    for step in steps.values():
        copies.append(dict(step))
    bank.steps = copies
    bank.updated_at = utc_now()
    bank.save()


def _agent_steps(steps):
    """Just the agents' cards."""
    agents = []
    for step in steps.values():
        if step["kind"] == "agent":
            agents.append(step)
    return agents


def _run_in_background(bank, command):
    """A thread is a second line of work inside the server: the request answers at once, and the panel goes
    on working. daemon=True means this thread never stops the server from shutting down."""
    threading.Thread(target=run_panel, args=(str(bank.id), command), daemon=True).start()


def _you_step_id(kind):
    """The id of the You card for this kind of question."""
    if kind == "plan":
        return "you:plan"
    return "you:review"


def _count(questions):
    """For example: 4 questions."""
    return _plural(len(questions or []), "question")


def _plural(count, word):
    """For example: 1 brief, 2 briefs."""
    if count == 1:
        return f"1 {word}"
    return f"{count} {word}s"


def _name(agent_id):
    """An agent's display name."""
    agent = find_agent(agent_id)
    if agent is None:
        return agent_id
    return agent["name"]
