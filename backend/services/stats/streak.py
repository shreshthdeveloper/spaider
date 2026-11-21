"""Your streak (days in a row with practice) and the calendar of the last few weeks."""
from datetime import timedelta

CALENDAR_WEEKS = 4
ONE_DAY = timedelta(days=1)


def streak(days, today):
    """days = {day: how many things you did}. Today isn't over yet, so if you haven't practised today,
    the streak still counts up to yesterday."""
    done_today = days.get(today, 0) > 0

    # count back, day by day, from today (or from yesterday, if today has nothing yet)
    if done_today:
        day = today
    else:
        day = today - ONE_DAY
    current = 0
    while days.get(day, 0) > 0:
        current += 1
        day -= ONE_DAY

    # whole days skipped since you last practised (practice yesterday = none skipped yet)
    last_day = None
    missed_days = 0
    if days:
        last_day = max(days)
        missed_days = max(0, (today - last_day).days - 1)

    last_day_text = None
    if last_day:
        last_day_text = last_day.isoformat()

    return {
        "current": current,
        "best": max(current, _longest_run(days)),
        "done_today": done_today,
        "today_count": days.get(today, 0),
        "last_day": last_day_text,
        "missed_days": missed_days,
    }


def calendar(days, today):
    """The last few weeks up to today, starting on a Monday: [{"day": "2026-11-21", "count": 2}, ...]."""
    day = today - timedelta(days=today.weekday() + 7 * (CALENDAR_WEEKS - 1))
    cells = []
    while day <= today:
        cells.append({"day": day.isoformat(), "count": days.get(day, 0)})
        day += ONE_DAY
    return cells


def _longest_run(days):
    """The most days in a row you ever practised."""
    best = 0
    for start in days:
        if days.get(start - ONE_DAY, 0) > 0:
            continue  # not the first day of a run
        length = 0
        while days.get(start + length * ONE_DAY, 0) > 0:
            length += 1
        best = max(best, length)
    return best
