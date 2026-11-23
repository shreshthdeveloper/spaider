"""The panel interview, through its routes: introductions, turns, follow-ups from other panelists, private
notes, verdicts, and the video call's voices."""
import time

from tests import fakes
from tests.helpers import answer_live

FORM = {
    "role": "Backend Engineer",
    "company": "Damco",
    "level": "Senior",
    "jd": "We need Python, RAG and AWS.",
    "resume": "Asha, asha@example.com, built a RAG bot.",
    "num_questions": "4",
    "follow_ups": "1",
    "mode": "text",
    "panelists": ["tech_lead", "hiring_manager", "resume"],
}


def _form(**changes):
    """FORM with some fields changed."""
    form = dict(FORM)
    form.update(changes)
    return form


def test_the_setup_is_checked(client):
    assert client.post("/api/panels", data=_form(panelists=["tech_lead"])).status_code == 400
    assert client.post("/api/panels", data=_form(role="", jd="")).status_code == 400
    assert client.post("/api/panels", data=_form(num_questions="5")).status_code == 400
    assert client.post("/api/panels", data=_form(mode="radio")).status_code == 400


def test_the_panel_introduces_itself_and_the_first_panelist_asks(client):
    panel = client.post("/api/panels", data=FORM).get_json()
    intros = panel["intros"]
    assert [line["speaker"] for line in intros] == ["tech_lead", "hiring_manager", "resume"]
    assert intros[0]["text"].startswith("Hi, and welcome to Damco.")
    assert intros[-1]["text"].endswith("Let's begin.")
    assert panel["question"]["speaker"] == "tech_lead" and panel["question"]["number"] == 1


def test_a_full_panel_with_a_follow_up_from_another_panelist(client):
    panel = client.post("/api/panels", data=FORM).get_json()
    path = f"/api/panels/{panel['id']}/answer/live"

    # a strong answer: every panelist writes a note at the same time, then the next panelist asks
    events, view = answer_live(client, path, "alpha beta gamma")
    listeners = []
    for name, data in events:
        if name == "start" and data["node"] == "listen":
            listeners.append(data["who"])
    assert sorted(listeners) == ["hiring_manager", "resume", "tech_lead"]
    assert view["question"]["speaker"] == "hiring_manager"
    assert view["results"] == [] and len(view["notes"]) == 3  # scores stay hidden until the end

    # a weak answer: the moderator picks a follow-up from a different panelist
    events, view = answer_live(client, path, "alpha only")
    assert view["question"]["kind"] == "follow_up"
    assert view["question"]["speaker"] != "hiring_manager"

    for text in ["beta covered", "alpha beta gamma", "alpha beta gamma"]:
        events, view = answer_live(client, path, text)
    assert view["status"] == "finished"
    assert len(view["verdicts"]) == 3
    assert view["report"]["decision"] in ("Hire", "No hire")
    actions = []
    for decision in view["decisions"]:
        actions.append(decision["action"])
    assert actions == ["new_question", "follow_up", "new_question", "new_question", "wrap_up"]
    assert client.post(path, json={"answer": "again"}).status_code == 409


def test_ending_before_any_answer(client):
    panel = client.post("/api/panels", data=FORM).get_json()
    ended = client.post(f"/api/panels/{panel['id']}/end").get_json()
    assert ended["status"] == "finished"
    assert ended["report"]["decision"] == "No decision" and ended["verdicts"] == []


def test_a_video_call_voices_each_panelist_in_their_own_voice(client):
    panel = client.post("/api/panels", data=_form(mode="voice", panelists=["tech_lead", "hr"])).get_json()
    assert panel["mode"] == "voice"
    time.sleep(0.5)  # the voices are made in a background thread
    voices = set()
    for _text, voice in fakes.SPOKEN:
        voices.add(voice)
    assert voices == {"cedar", "shimmer"}


def test_the_resume_grind_weak_lines_reach_the_panel(client):
    resume_text = "Asha\n- Cut checkout latency by 40% by caching the cart in Redis\n- Built a RAG assistant\n" + "filler " * 40
    client.post("/api/resume", data={"text": resume_text})
    from models.resume import current_resume

    resume = current_resume()
    resume.claims[0]["level"] = "red"
    resume.save()

    response = client.post("/api/panels", data=_form(resume="", use_resume_grind="yes"))
    assert response.status_code == 201
    brief = fakes.PROMPTS["PanelBrief"][-1]
    assert "Weak resume lines" in brief and "Cut checkout latency by 40%" in brief


def test_the_voice_route_only_takes_known_voices(client):
    assert client.post("/api/voice/speak", json={"text": "Hello", "voice": "someone"}).status_code == 400
    assert client.post("/api/voice/speak", json={"text": "Hello", "voice": "coral"}).status_code == 200
    assert fakes.SPOKEN[-1] == ("Hello", "coral")
