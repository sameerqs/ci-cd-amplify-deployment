import json
import logging

from app.core.logging import (
    JsonFormatter,
    RequestIdFilter,
    configure_logging,
    request_id_var,
    sanitize_request_id,
)


def test_sanitize_request_id_accepts_safe_values() -> None:
    assert sanitize_request_id("abc-123_x.y") == "abc-123_x.y"
    assert sanitize_request_id("a" * 64) == "a" * 64


def test_sanitize_request_id_replaces_unsafe_values() -> None:
    for bad in (None, "", "a" * 65, "line\nbreak", "sp ace", "тест", '{"json":1}'):
        generated = sanitize_request_id(bad)
        assert generated != bad
        assert len(generated) == 32
        assert generated.isalnum()


def test_json_formatter_includes_request_id_and_exception() -> None:
    request_id_var.set("req-1")
    record = logging.LogRecord("app.test", logging.ERROR, __file__, 1, "hello %s", ("world",), None)
    RequestIdFilter().filter(record)
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record.exc_info = sys.exc_info()
    payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == "hello world"
    assert payload["request_id"] == "req-1"
    assert payload["level"] == "ERROR"
    assert "ValueError: boom" in payload["exception"]
    assert payload["timestamp"].endswith("+00:00")


def test_json_formatter_surfaces_a_tracked_event() -> None:
    record = logging.LogRecord("app.analytics", logging.INFO, __file__, 1, "chip_tapped", (), None)
    record.event = "chip_tapped"
    record.event_fields = {"label": "Start with the bill"}
    payload = json.loads(JsonFormatter().format(record))
    assert payload["event"] == "chip_tapped"
    assert payload["event_fields"] == {"label": "Start with the bill"}


def test_json_formatter_omits_event_fields_for_an_ordinary_log_line() -> None:
    record = logging.LogRecord("app.chat", logging.INFO, __file__, 1, "hello", (), None)
    payload = json.loads(JsonFormatter().format(record))
    assert "event" not in payload
    assert "event_fields" not in payload


def test_configure_logging_both_modes() -> None:
    configure_logging("DEBUG", json_output=True)
    assert isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)
    configure_logging("info", json_output=False)
    assert logging.getLogger().level == logging.INFO
    assert not isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)
