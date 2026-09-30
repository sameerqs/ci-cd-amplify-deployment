import math
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.envelope import ENVELOPE_CONFIG, ApiError, ApiResponse, WarningInfo
from app.core.utils import utc_now

INTERNAL_ERROR_MESSAGE = "Internal server error"
STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "UNPROCESSABLE_ENTITY",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
}
_LOCATION_PREFIXES = {"body", "query", "path", "header", "cookie"}


def code_for_status(status: int) -> str:
    return STATUS_CODES.get(status, "INTERNAL_ERROR" if status >= 500 else "ERROR")


class ErrorData(BaseModel):
    model_config = ENVELOPE_CONFIG

    status_code: int
    path: str
    timestamp: datetime
    retry_after: int | None = None


class AppError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        errors: Sequence[ApiError] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.errors = list(errors) if errors else None
        self.headers = dict(headers) if headers else {}


class BadRequestError(AppError):
    status_code = 400
    code = "BAD_REQUEST"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"

    def __init__(self, message: str = "Unauthorized", *, code: str | None = None) -> None:
        super().__init__(message, code=code, headers={"WWW-Authenticate": "Bearer"})


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "SERVICE_UNAVAILABLE"


def humanize_seconds(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    minutes = math.ceil(seconds / 60)
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


class RateLimitedError(AppError):
    status_code = 429
    code = "RATE_LIMITED"

    def __init__(self, retry_after: int) -> None:
        self.retry_after = max(1, retry_after)
        super().__init__(
            f"Too many requests. Please try again in {humanize_seconds(self.retry_after)}.",
            headers={"Retry-After": str(self.retry_after)},
        )


def failure(
    *,
    status: int,
    message: str,
    path: str,
    code: str | None = None,
    errors: Sequence[ApiError] | None = None,
    retry_after: int | None = None,
    warning: WarningInfo | None = None,
    authored: bool = False,
) -> ApiResponse[ErrorData]:
    # why: a 5xx we RAISED ourselves carries a message we wrote, for the caller
    # to act on -- "Language model is not configured" tells the client the
    # assistant is unavailable rather than broken. Masking those to "Internal
    # server error" alongside genuine crashes threw that away. Unhandled
    # exceptions are still masked; their text is not ours and may say anything.
    expose = settings.expose_error_details or status < 500 or authored
    shown = message if expose else INTERNAL_ERROR_MESSAGE
    error_code = code or code_for_status(status)
    error_list = list(errors) if errors else [ApiError(message=shown, code=error_code)]
    return ApiResponse[ErrorData](
        is_success=False,
        message=shown,
        data=ErrorData(status_code=status, path=path, timestamp=utc_now(), retry_after=retry_after),
        errors=error_list,
        warning_heading=warning.heading if warning else "",
        warning_message=warning.message if warning else "",
        warning_type=warning.type if warning else None,
    )


def envelope_response(
    status: int, payload: ApiResponse[Any], headers: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=payload.model_dump(mode="json", by_alias=True),
        headers=headers,
    )


def error_response(
    *,
    status: int,
    message: str,
    path: str,
    code: str | None = None,
    errors: Sequence[ApiError] | None = None,
    retry_after: int | None = None,
    warning: WarningInfo | None = None,
    headers: dict[str, str] | None = None,
    authored: bool = False,
) -> JSONResponse:
    payload = failure(
        status=status,
        message=message,
        path=path,
        authored=authored,
        code=code,
        errors=errors,
        retry_after=retry_after,
        warning=warning,
    )
    return envelope_response(status, payload, headers)


def field_from_loc(loc: Sequence[int | str]) -> str | None:
    parts = list(loc)
    if parts and parts[0] in _LOCATION_PREFIXES:
        parts = parts[1:]
    if not parts:
        return None
    field = ""
    for part in parts:
        if isinstance(part, int):
            field += f"[{part}]"
        else:
            field += f".{part}" if field else str(part)
    return field


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    warning = None
    retry_after = None
    if isinstance(exc, RateLimitedError):
        retry_after = exc.retry_after
        warning = WarningInfo(heading="Too many requests", message=exc.message, type="CRITICAL")
    return error_response(
        status=exc.status_code,
        message=exc.message,
        path=request.url.path,
        code=exc.code,
        errors=exc.errors,
        retry_after=retry_after,
        warning=warning,
        headers=exc.headers,
        authored=True,
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: list[ApiError] = []
    for detail in exc.errors():
        field = field_from_loc(detail.get("loc", ()))
        text = str(detail.get("msg", "Invalid value"))
        errors.append(
            ApiError(
                field=field,
                code=STATUS_CODES[422],
                message=f"{field}: {text}" if field else text,
            )
        )
    message = errors[0].message if errors else "Validation failed"
    return error_response(status=422, message=message, path=request.url.path, errors=errors)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return error_response(
        status=exc.status_code,
        message=detail,
        path=request.url.path,
        headers=dict(exc.headers) if exc.headers else None,
    )


def install_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
