import json
import logging
import re
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from logging.config import dictConfig
from typing import Any

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
REQUEST_ID_HEADER = "X-Request-ID"
access_logger = logging.getLogger("app.access")


def sanitize_request_id(value: str | None) -> str:
    if value is not None and REQUEST_ID_PATTERN.fullmatch(value):
        return value
    return uuid.uuid4().hex


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        # why: app.core.analytics.track() passes a named event and its scalar
        # fields through `extra` -- surfacing them is what makes a JSON log line
        # a structured event a log pipeline can query, not just free text.
        event = getattr(record, "event", None)
        if event is not None:
            payload["event"] = event
            payload["event_fields"] = getattr(record, "event_fields", {})
        return json.dumps(payload, default=str)


def configure_logging(level: str, json_output: bool) -> None:
    formatter: dict[str, Any] = (
        {"()": "app.core.logging.JsonFormatter"}
        if json_output
        else {"format": "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"}
    )
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"request_id": {"()": "app.core.logging.RequestIdFilter"}},
            "formatters": {"default": formatter},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "filters": ["request_id"],
                    "stream": "ext://sys.stderr",
                }
            },
            "root": {"level": level.upper(), "handlers": ["console"]},
            "loggers": {
                "uvicorn": {"handlers": [], "propagate": True},
                "uvicorn.error": {"handlers": [], "propagate": True},
                "uvicorn.access": {"handlers": [], "level": "WARNING", "propagate": True},
            },
        }
    )


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = sanitize_request_id(Headers(scope=scope).get(REQUEST_ID_HEADER))
        request_id_var.set(request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            access_logger.info(
                "%s %s %d %.1fms",
                scope.get("method", "-"),
                scope.get("path", "-"),
                status,
                elapsed_ms,
            )
