"""Product analytics: one place any code logs a named event from.

No vendor is wired up yet, so this writes a structured line through the same
JSON logger every request already flows through (app/core/logging.py) rather
than inventing a client SDK integration nobody asked for. Swapping in a real
vendor later is a one-file change -- call sites never talk to it directly.

why: several events are safety- or privacy-sensitive by contract (an emergency
redirect must log with no message text; an attachment event must not log its
bytes) -- track() takes only scalar fields, so there is no `**payload` a caller
could pass a message body or file contents through by accident.
"""

import logging
from typing import Literal

logger = logging.getLogger("app.analytics")

Scalar = str | int | float | bool | None

# why: a fixed set, not a free string -- the whole point of a named event is
# that every emitter and every consumer agree on the name. New events extend
# this rather than being typo'd into existence at the call site.
Event = Literal[
    "chat_opened",
    "message_sent",
    "ai_reply_failed",
    "emergency_redirect_shown",
    "chip_tapped",
    "capture_sheet_opened",
    "attachment_uploaded",
    "attachment_failed",
    "feature_vote_set",
    "feature_comment_saved",
]


def track(event: Event, **fields: Scalar) -> None:
    logger.info(event, extra={"event": event, "event_fields": fields})
