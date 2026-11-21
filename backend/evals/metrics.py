"""The maths of an eval: how often the AI agrees with the answer key. Plain counting, no libraries."""


def ratio(part, whole):
    """part / whole, rounded (None when there is nothing to divide by)."""
    if whole == 0:
        return None
    return round(part / whole, 3)


def key_point_metrics(cases):
    """For the interview grader. Each case has "expected" (your labels) and "got" (the grader's),
    one True/False per key point: was this point covered by the answer?

    point_accuracy  how often the grader agrees with you, point by point
    precision       of the points it gave credit for, how many you agree were covered
                    (low = too generous: it gives credit for things not really said)
    recall          of the points you say were covered, how many it gave credit for
                    (low = too harsh: it misses things that were said)
    """
    total = 0
    agreed = 0
    credited = 0  # points the grader said were covered
    credited_rightly = 0  # ...and you agree
    really_covered = 0  # points you say were covered
    found = 0  # ...and the grader credited them

    for case in cases:
        for expected, got in zip(case["expected"], case["got"]):
            total += 1
            if expected == got:
                agreed += 1
            if got:
                credited += 1
                if expected:
                    credited_rightly += 1
            if expected:
                really_covered += 1
                if got:
                    found += 1

    return {
        "point_accuracy": ratio(agreed, total),
        "precision": ratio(credited_rightly, credited),
        "recall": ratio(found, really_covered),
    }


def score_metrics(cases):
    """For the interview grader: its 0-5 score next to the score your labels give.

    exact_score  how often the two scores are the same
    score_gap    the average difference between them (mean absolute error), in points
    """
    if not cases:
        return {"exact_score": None, "score_gap": None}
    exact = 0
    gap = 0
    for case in cases:
        difference = abs(case["expected_score"] - case["got_score"])
        gap += difference
        if difference == 0:
            exact += 1
    return {"exact_score": ratio(exact, len(cases)), "score_gap": round(gap / len(cases), 2)}


def drop_metrics(cases):
    """For the question bank judge. Each case has "expected_drop" (planted bad question?) and "got_drop".

    accuracy   how often its keep/drop call is right
    precision  of the questions it dropped, how many were really bad (low = it throws away good ones)
    recall     of the planted bad questions, how many it caught (low = bad ones get through)
    """
    right = 0
    dropped = 0
    dropped_rightly = 0
    planted = 0
    caught = 0
    for case in cases:
        if case["expected_drop"] == case["got_drop"]:
            right += 1
        if case["got_drop"]:
            dropped += 1
            if case["expected_drop"]:
                dropped_rightly += 1
        if case["expected_drop"]:
            planted += 1
            if case["got_drop"]:
                caught += 1
    return {
        "accuracy": ratio(right, len(cases)),
        "precision": ratio(dropped_rightly, dropped),
        "recall": ratio(caught, planted),
    }


def score_from_points(covered):
    """The same rule the grader uses (services/interview/nodes.py): 5 x the share of points covered."""
    if not covered:
        return 0
    count = 0
    for point_covered in covered:
        if point_covered:
            count += 1
    return round(5 * count / len(covered))
