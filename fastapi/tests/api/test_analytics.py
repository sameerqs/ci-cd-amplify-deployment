"""The client-event sink for PET-7/8/9's chip_tapped and capture_sheet_opened.

Every other named event (chat_opened, message_sent, ai_reply_failed,
emergency_redirect_shown, attachment_uploaded, attachment_failed) is logged
where the app already does the corresponding work -- see tests/api/test_chat.py,
test_chat_guardrails.py, and test_attachments.py, which assert on those through
the same app.analytics logger this module tests directly.
"""

import logging

import pytest
from httpx import AsyncClient

from app.modules.users.models import User
from tests.api.conftest import auth_headers

EVENTS_URL = "/api/v1/events"


def _field(record: logging.LogRecord, name: str) -> object:
    """The dynamic attributes app.core.analytics.track() sets via `extra`.

    why: LogRecord has no static event/event_fields attributes -- mypy --strict
    is right to reject `record.event` -- but indexing __dict__ is what `extra`
    actually populates, so this is the honest way to read it back in a test.
    """
    return record.__dict__[name]


async def test_a_client_event_reaches_the_analytics_log(
    client: AsyncClient, plain_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.analytics"):
        res = await client.post(
            EVENTS_URL,
            headers=auth_headers(plain_user),
            json={"event": "chip_tapped", "properties": {"label": "Start with the bill"}},
        )

    assert res.status_code == 200, res.text
    # why: caplog's handler sits on the root logger, so records is every logger's
    # output for the request (app.access, httpx, ...), not just this one -- and
    # caplog's own formatter never renders `extra` into caplog.text regardless
    # (that only happens through JsonFormatter in a real deployment; see
    # test_logging.py). Filtering by logger name and reading the record's
    # attributes is what actually proves track() ran.
    record = next(r for r in caplog.records if r.name == "app.analytics")
    assert _field(record, "event") == "chip_tapped"
    assert _field(record, "event_fields") == {"label": "Start with the bill"}


async def test_the_other_client_event_also_reaches_the_log(
    client: AsyncClient, plain_user: User, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.analytics"):
        res = await client.post(
            EVENTS_URL, headers=auth_headers(plain_user), json={"event": "capture_sheet_opened"}
        )

    assert res.status_code == 200, res.text
    record = next(r for r in caplog.records if r.name == "app.analytics")
    assert _field(record, "event") == "capture_sheet_opened"


async def test_an_event_outside_the_client_allow_list_is_rejected(
    client: AsyncClient, plain_user: User
) -> None:
    # why: chat_opened and the rest are only ever true when the app itself did
    # the corresponding work. Letting a client POST them here would let anyone
    # write a fake "message_sent" or "emergency_redirect_shown" into the log.
    res = await client.post(
        EVENTS_URL, headers=auth_headers(plain_user), json={"event": "message_sent"}
    )
    assert res.status_code == 422


async def test_an_unknown_field_is_rejected(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(
        EVENTS_URL,
        headers=auth_headers(plain_user),
        json={"event": "chip_tapped", "somethingElse": 1},
    )
    assert res.status_code == 422


async def test_tracking_requires_authentication(client: AsyncClient) -> None:
    res = await client.post(EVENTS_URL, json={"event": "chip_tapped"})
    assert res.status_code == 401
