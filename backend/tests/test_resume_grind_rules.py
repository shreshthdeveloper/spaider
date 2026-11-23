"""The Resume grind's plain-code rules: privacy, matching claims across versions, and the repeat schedule.
No database and no AI needed."""
from services.resume_grind.claims import find_lines, match_with_before
from services.resume_grind.privacy import remove_contact_details
from services.resume_grind.schedule import pick_for_grind, save_answer, today


def test_contact_details_are_removed_but_dates_stay():
    text = "Asha | asha@example.com | +91 98765 43210 | linkedin.com/in/asha | https://github.com/asha\nShopfast, 2019 - 2023"
    clean, removed = remove_contact_details(text)
    assert removed == 4
    assert "asha@example.com" not in clean and "98765" not in clean
    assert "linkedin" not in clean and "github" not in clean
    assert "2019 - 2023" in clean


def test_a_wrapped_bullet_is_found_across_two_lines():
    lines = ["Backend Engineer", "- Cut checkout latency by 40% by caching", "the cart in Redis", "Skills"]
    assert find_lines("Cut checkout latency by 40% by caching the cart in Redis", lines) == (1, 2)
    assert find_lines("Something not in the resume at all", lines) == (None, 0)


def _claim(claim_id, quote, level="untested", due=""):
    """A claim dict, as the backend stores it."""
    return {"id": claim_id, "quote": quote, "status": "new", "before": "", "score": None, "level": level, "due": due, "attempts": []}


def test_a_new_version_keeps_progress_and_flags_changes():
    old = [
        _claim("a", "Cut checkout latency by 40% by caching the cart", level="green", due="2099-01-01"),
        _claim("b", "Built a RAG assistant with LangGraph"),
        _claim("c", "Wrote the nightly reconciliation job"),
    ]
    new = [
        _claim("x", "Cut checkout latency by 55% by caching the cart"),
        _claim("y", "Built a RAG assistant with LangGraph"),
        _claim("z", "Shipped a voice interviewer"),
    ]
    gone = match_with_before(old, new)

    assert new[0]["id"] == "a" and new[0]["status"] == "changed" and "40%" in new[0]["before"] and new[0]["due"] == ""
    assert new[1]["id"] == "b" and new[1]["status"] == "same"
    assert new[2]["id"] == "z" and new[2]["status"] == "new"
    assert [claim["quote"] for claim in gone] == ["Wrote the nightly reconciliation job"]


def test_scores_set_the_colour_and_the_next_day():
    claim = _claim("a", "Some claim")
    save_answer(claim, {"score": 5})
    assert claim["level"] == "green" and claim["due"] > today()
    save_answer(claim, {"score": 3})
    assert claim["level"] == "yellow"
    save_answer(claim, {"score": 1})
    assert claim["level"] == "red" and claim["status"] == "same" and len(claim["attempts"]) == 3


def test_a_grind_asks_changed_lines_first_then_the_weakest():
    changed = _claim("changed", "Changed line", level="green")
    changed["status"] = "changed"
    claims = [
        _claim("green", "Strong line", level="green", due="2099-01-01"),
        _claim("untested", "Untested line"),
        _claim("red", "Weak line", level="red"),
        changed,
    ]
    picked = pick_for_grind(claims, 3)
    assert [claim["id"] for claim in picked] == ["changed", "red", "untested"]
    # fewer due than asked for: the others fill the grind up
    assert len(pick_for_grind(claims, 4)) == 4
