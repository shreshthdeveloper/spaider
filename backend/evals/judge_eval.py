"""Eval 2: the question bank judge. Does it drop the bad questions, and keep the good ones?

It runs the REAL judge step of the question bank (services/question_bank/nodes.py, judge) on
cases/judge_cases.json: 16 draft questions, 6 of them planted bad (repeats, too easy, vague,
wrong key points, three questions in one)."""
import json
from pathlib import Path

from evals.metrics import drop_metrics
from services.question_bank.nodes import judge

CASES_FILE = Path(__file__).parent / "cases" / "judge_cases.json"


def load_cases():
    """The answer key: the role, the briefs and the 16 questions in cases/judge_cases.json."""
    return json.loads(CASES_FILE.read_text())


def run():
    """One judge call on the whole set. Returns {"metrics": {...}, "cases": [one result per question]}."""
    data = load_cases()
    state = _judge_state(data)
    verdict = judge(state)["verdict"]

    reasons = {}
    for drop in verdict["drop"]:
        reasons[drop["id"]] = drop["reason"]

    results = []
    for agent_id, questions in data["questions"].items():
        for number, item in enumerate(questions, start=1):
            question_id = f"{agent_id}-{number}"  # the same ids the judge sees
            expected_drop = item["expect"] == "drop"
            got_drop = question_id in reasons
            results.append({
                "id": question_id,
                "agent": agent_id,
                "kind": item["kind"],
                "question": item["question"],
                "expected_drop": expected_drop,
                "got_drop": got_drop,
                "reason": reasons.get(question_id, ""),
                "scores": verdict["scores"].get(question_id),
                "passed": expected_drop == got_drop,
                "error": "",
            })

    metrics = drop_metrics(results)
    metrics["cases"] = len(results)
    metrics["summary"] = verdict["summary"]
    return {"metrics": metrics, "cases": results}


def _judge_state(data):
    """The state the panel graph would give the judge, built from the case file."""
    drafts = {}
    for agent_id, questions in data["questions"].items():
        drafts[agent_id] = []
        for item in questions:
            drafts[agent_id].append({
                "question": item["question"],
                "key_points": item["key_points"],
                "difficulty": item["difficulty"],
                "based_on": "",
                "brief": "",
                "problem_id": "",
            })
    return {
        "bank_id": "eval",
        "inputs": data["inputs"],
        "agent_ids": list(data["questions"]),
        "briefs": data["briefs"],
        "drafts": drafts,
        "revisions": 1,  # the final check: we test its keep/drop calls, not its send-backs
        "restored": [],
    }
