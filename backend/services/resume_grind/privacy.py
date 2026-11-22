"""Takes contact details out of a resume before it is saved or sent to the AI."""
import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
LINK = re.compile(r"(https?://\S+|www\.\S+|\b(linkedin|github)\.com/\S+)", re.IGNORECASE)
PHONE = re.compile(r"\+?\d[\d ().-]{8,}\d")
MIN_PHONE_DIGITS = 10  # fewer digits is more likely a date range, like "2019 - 2023"


def remove_contact_details(text):
    """Returns (the text without emails, links and phone numbers, how many were taken out).
    The name stays: it can't be told apart from other words reliably."""
    text, emails = EMAIL.subn("[email removed]", text)
    text, links = LINK.subn("[link removed]", text)
    text, phones = _remove_phones(text)
    return text, emails + links + phones


def _remove_phones(text):
    """Replaces every run of 10 or more digits (with spaces, dashes or brackets between them)."""
    pieces = []
    removed = 0
    last_end = 0
    for match in PHONE.finditer(text):
        if _count_digits(match.group()) < MIN_PHONE_DIGITS:
            continue
        pieces.append(text[last_end:match.start()])
        pieces.append("[phone removed]")
        last_end = match.end()
        removed += 1
    pieces.append(text[last_end:])
    return "".join(pieces), removed


def _count_digits(text):
    """How many digits are in the text."""
    count = 0
    for char in text:
        if char.isdigit():
            count += 1
    return count
