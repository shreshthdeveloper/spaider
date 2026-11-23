"""The Resume grind, through its routes: upload, a grind, scores flowing back to the lines, a new version."""
from tests import fakes

RESUME = """Asha Example
asha@example.com | +91 98765 43210 | linkedin.com/in/asha-example
Backend Engineer, Shopfast, 2019 - 2023
- Cut checkout latency by 40% by caching the cart in Redis
- Built a RAG assistant with LangGraph that answers support tickets
- Led a team of 5 engineers through the move to Kubernetes
Skills: Python, Flask, React
"""


def _answer_until_finished(client, interview_id, answers):
    """Answers in turn until the interview finishes. Returns the last view."""
    view = None
    for text in answers:
        view = client.post(f"/api/interviews/{interview_id}/answer", json={"answer": text}).get_json()
        if view["status"] == "finished":
            break
    return view


def test_upload_finds_the_real_claims_and_hides_contact_details(client):
    assert client.get("/api/resume").get_json() == {"resume": None}
    assert client.post("/api/resume", data={"text": "too short"}).status_code == 400

    resume = client.post("/api/resume", data={"text": RESUME}).get_json()["resume"]
    text = "\n".join(resume["lines"])
    assert resume["removed_details"] == 3
    assert "asha@example.com" not in text and "98765" not in text
    quotes = [claim["quote"] for claim in resume["claims"]]
    assert len(quotes) == 3 and "Invented the internet single handedly" not in quotes  # made-up claims are dropped
    assert resume["counts"]["untested"] == 3 and resume["due"] == 3


def test_a_grind_scores_each_line_and_a_new_version_keeps_the_progress(client):
    client.post("/api/resume", data={"text": RESUME})
    grind = client.post("/api/resume/grind", json={"count": 3, "mode": "text"}).get_json()
    assert grind["source"] == "resume" and grind["num_questions"] == 3
    assert "3 lines of your resume" in grind["question"]["intro"]

    # line 1: both points (5/5); line 2: one point, then a follow-up; line 3: nothing
    finished = _answer_until_finished(client, grind["id"], ["measured own", "measured", "still vague", "nothing", "nothing", "x"])
    assert finished["status"] == "finished"

    resume = client.get("/api/resume").get_json()["resume"]
    levels = []
    for claim in resume["claims"]:
        levels.append(claim["level"])
    assert levels == ["green", "red", "red"]
    assert resume["last_grind"]["asked"] == 3 and resume["open_grind"] is None

    # version 2: one number changed, one line removed, one line added
    version_2 = RESUME.replace("by 40%", "by 55%").replace("- Led a team of 5 engineers through the move to Kubernetes\n", "")
    version_2 = version_2.replace("Skills:", "- Shipped a voice interviewer with OpenAI speech\nSkills:")
    resume = client.post("/api/resume", data={"text": version_2}).get_json()["resume"]
    assert resume["version"] == 2
    assert resume["changes"]["new"] == 1 and resume["changes"]["changed"] == 1 and len(resume["changes"]["removed"]) == 1
    changed = resume["claims"][0]
    assert changed["status"] == "changed" and "40%" in changed["before"] and changed["attempts"]

    # the next grind asks the changed line first, and tells the AI what it used to say
    client.post("/api/resume/grind", json={"count": 3, "mode": "text"})
    prompt = fakes.PROMPTS["GrindQuestions"][-1]
    assert prompt.startswith("1. Claim: Cut checkout latency by 55%")
    assert "CHANGED" in prompt and "Asked before" in prompt


def test_remove_the_resume(client):
    client.post("/api/resume", data={"text": RESUME})
    assert client.delete("/api/resume").get_json() == {"deleted": True}
    assert client.get("/api/resume").get_json() == {"resume": None}
