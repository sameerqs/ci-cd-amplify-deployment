import pytest

from app.core.config import settings
from app.core.envelope import ApiError
from app.core.errors import (
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    UnauthorizedError,
    code_for_status,
    failure,
    field_from_loc,
    humanize_seconds,
)


def test_field_from_loc() -> None:
    assert field_from_loc(("body", "email")) == "email"
    assert field_from_loc(("body", "items", 0, "id")) == "items[0].id"
    assert field_from_loc(("query", "pageSize")) == "pageSize"
    assert field_from_loc(("body",)) is None
    assert field_from_loc(()) is None


def test_humanize_seconds() -> None:
    assert humanize_seconds(1) == "1 second"
    assert humanize_seconds(30) == "30 seconds"
    assert humanize_seconds(60) == "1 minute"
    assert humanize_seconds(61) == "2 minutes"


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "BAD_REQUEST"),
        (401, "UNAUTHORIZED"),
        (404, "NOT_FOUND"),
        (418, "ERROR"),
        (502, "INTERNAL_ERROR"),
    ],
)
def test_code_for_status(status: int, code: str) -> None:
    assert code_for_status(status) == code


def test_error_classes_carry_status_code_and_headers() -> None:
    assert BadRequestError("x").status_code == 400
    assert UnauthorizedError().headers == {"WWW-Authenticate": "Bearer"}
    assert UnauthorizedError().message == "Unauthorized"
    assert ForbiddenError("x", code="PASSWORD_CHANGE_REQUIRED").code == "PASSWORD_CHANGE_REQUIRED"
    assert NotFoundError("x").code == "NOT_FOUND"
    assert ConflictError("x").status_code == 409
    assert ServiceUnavailableError("x").status_code == 503
    limited = RateLimitedError(0)
    assert limited.retry_after == 1
    assert limited.headers == {"Retry-After": "1"}
    errors = [ApiError(message="m")]
    custom = AppError("boom", errors=errors, headers={"X": "1"})
    assert custom.errors == errors
    assert custom.headers == {"X": "1"}
    assert str(custom) == "boom"


def test_failure_masks_5xx_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ENV", "production")
    masked = failure(status=500, message="secret detail", path="/x")
    assert masked.message == "Internal server error"
    assert masked.errors[0].message == "Internal server error"
    assert masked.errors[0].code == "INTERNAL_ERROR"
    assert masked.data.status_code == 500
    assert masked.data.path == "/x"
    monkeypatch.setattr(settings, "ENV", "development")
    shown = failure(status=500, message="secret detail", path="/x")
    assert shown.message == "secret detail"


def test_failure_keeps_4xx_and_extras() -> None:
    payload = failure(
        status=429,
        message="slow down",
        path="/x",
        retry_after=7,
        errors=[ApiError(message="a"), ApiError(message="b")],
    )
    assert payload.is_success is False
    assert payload.data.retry_after == 7
    assert [e.message for e in payload.errors] == ["a", "b"]
    dumped = payload.model_dump(mode="json", by_alias=True)
    assert dumped["data"]["statusCode"] == 429
    assert dumped["data"]["retryAfter"] == 7
