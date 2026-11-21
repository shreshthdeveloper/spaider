"""What the stats route calls: your streak, your spider's health and the tasks on your web.
It only reads what the other features saved. It never changes anything."""
from models.question_bank import QuestionBank
from services.stats.activity import activity_by_day, bank_days, local_today, quiz_days, round_totals
from services.stats.health import health
from services.stats.streak import calendar, streak
from services.stats.web import web_tasks


def get_stats(minutes_ahead=0):
    """Everything the Stats page and the pet spider show, worked out from what the rounds saved."""
    today = local_today(minutes_ahead)
    quizzes = quiz_days(minutes_ahead)
    days = activity_by_day(minutes_ahead, quizzes)

    run = streak(days, today)
    banks = bank_days(minutes_ahead)
    flies = web_tasks(run["done_today"], today in banks)
    totals = round_totals()
    totals["banks"] = QuestionBank.objects.count()
    return {
        "today": today.isoformat(),
        "streak": run,
        "health": health(run, flies),
        "web": flies,
        "calendar": calendar(days, today),
        "totals": totals,
    }
