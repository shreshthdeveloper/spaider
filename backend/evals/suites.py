"""The eval suites: what each one tests, the prompt it tests, and the function that runs it.
Add a suite here and it shows up on the Evals page and in `python -m evals.run`."""
import hashlib
import os

from evals import grader_eval, judge_eval
from services.interview.prompts import JUDGE_PROMPT as GRADER_PROMPT
from services.question_bank.prompts import JUDGE_PROMPT as BANK_JUDGE_PROMPT

SUITES = {
    "grader": {
        "name": "Interview grader",
        "tests": "Does the grader agree with you about which key points an answer covers?",
        "prompt": GRADER_PROMPT,
        "run": grader_eval.run,
    },
    "judge": {
        "name": "Question bank judge",
        "tests": "Does the judge drop the planted bad questions, and keep the good ones?",
        "prompt": BANK_JUDGE_PROMPT,
        "run": judge_eval.run,
    },
}


def describe():
    """The suites for the Evals page: name, what they test, how many cases and AI calls."""
    grader_cases = len(grader_eval.load_cases())
    judge_cases = 0
    for questions in judge_eval.load_cases()["questions"].values():
        judge_cases += len(questions)
    sizes = {
        "grader": {"cases": grader_cases, "ai_calls": grader_cases},  # one grading call per answer
        "judge": {"cases": judge_cases, "ai_calls": 1},  # the judge scores the whole set in one call
    }

    suites = []
    for suite_id, suite in SUITES.items():
        suites.append({
            "id": suite_id,
            "name": suite["name"],
            "tests": suite["tests"],
            "cases": sizes[suite_id]["cases"],
            "ai_calls": sizes[suite_id]["ai_calls"],
            "prompt_version": prompt_version(suite_id),
        })
    return suites


def prompt_version(suite_id):
    """A short fingerprint of the prompt under test. It changes whenever the prompt text changes,
    so the run history shows which prompt version got which score."""
    text = SUITES[suite_id]["prompt"]
    return hashlib.sha1(text.encode()).hexdigest()[:7]


def model_name():
    """The AI model being tested (MODEL in .env)."""
    return os.getenv("MODEL", "openai:gpt-6-luna")  # the same default as services/llm.py
