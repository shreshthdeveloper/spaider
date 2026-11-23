"""The mock interview, through its routes: Bella's greeting, follow-ups, the report, and the live stream."""
from tests.helpers import answer_live


def test_bella_greets_you_with_the_first_question_only(client):
    started = client.post("/api/interviews", json={"topic": "Kafka basics", "num_questions": 2, "mode": "text"}).get_json()
    greeting = started["question"]["intro"]
    assert greeting.startswith("Hi, I'm Bella")
    assert "Kafka basics: 2 questions" in greeting

    after_answer = client.post(f"/api/interviews/{started['id']}/answer", json={"answer": "no idea"}).get_json()
    assert after_answer["question"]["intro"] == ""


def test_a_pasted_job_description_is_not_read_out(client):
    long_topic = "We are hiring an engineer who will own our data platform, work with customers and build pipelines at scale"
    started = client.post("/api/interviews", json={"topic": long_topic, "num_questions": 3, "mode": "text"}).get_json()
    assert "the role you shared: 3 questions" in started["question"]["intro"]


def test_a_weak_answer_gets_a_follow_up_and_the_interview_ends_with_a_report(client):
    started = client.post("/api/interviews", json={"topic": "Kafka", "num_questions": 1, "follow_ups": 1, "mode": "text"}).get_json()
    interview_id = started["id"]

    events, view = answer_live(client, f"/api/interviews/{interview_id}/answer/live", "alpha only")
    started_steps = []
    for name, data in events:
        if name == "start":
            started_steps.append(data["node"])
    assert "grade" in started_steps and "follow_up" in started_steps
    assert view["question"]["is_follow_up"] is True

    events, view = answer_live(client, f"/api/interviews/{interview_id}/answer/live", "beta and gamma")
    assert view["status"] == "finished"
    assert view["report"]["overall"] == 2  # the main question covered 1 of 3 points; follow-ups don't count
    assert len(view["results"]) == 2


def test_bad_requests_are_refused(client):
    assert client.post("/api/interviews", json={"topic": ""}).status_code == 400
    assert client.post("/api/interviews", json={"topic": "Kafka", "num_questions": 50}).status_code == 400
    assert client.get("/api/interviews/not-an-id").status_code == 404
