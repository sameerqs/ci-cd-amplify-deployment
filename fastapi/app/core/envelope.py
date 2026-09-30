from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

WarningType = Literal["INFO", "SOFT", "CRITICAL"]

ENVELOPE_CONFIG = ConfigDict(
    alias_generator=to_camel,
    serialize_by_alias=True,
    validate_by_name=True,
    validate_by_alias=True,
    from_attributes=True,
)


class ApiError(BaseModel):
    model_config = ENVELOPE_CONFIG

    field: str | None = None
    code: str | None = None
    message: str


class WarningInfo(BaseModel):
    heading: str = ""
    message: str = ""
    type: WarningType = "INFO"


class Empty(BaseModel):
    model_config = ENVELOPE_CONFIG


class Items[T](BaseModel):
    model_config = ENVELOPE_CONFIG

    items: list[T]


class PaginatedData[T](BaseModel):
    model_config = ENVELOPE_CONFIG

    items: list[T]
    page: int
    page_size: int
    total_records: int
    total_pages: int


class ApiResponse[T](BaseModel):
    model_config = ENVELOPE_CONFIG

    is_success: bool
    message: str = ""
    data: T
    errors: list[ApiError] = Field(default_factory=list)
    warning_heading: str = ""
    warning_message: str = ""
    warning_type: WarningType | None = None


def ok[T: BaseModel](
    data: T, *, message: str = "", warning: WarningInfo | None = None
) -> ApiResponse[T]:
    response: ApiResponse[T] = ApiResponse(
        is_success=True,
        message=message,
        data=data,
        warning_heading=warning.heading if warning else "",
        warning_message=warning.message if warning else "",
        warning_type=warning.type if warning else None,
    )
    return response


def ok_items[T: BaseModel](items: Sequence[T], *, message: str = "") -> ApiResponse[Items[T]]:
    payload: Items[T] = Items(items=list(items))
    return ok(payload, message=message)


def ok_empty(message: str = "") -> ApiResponse[Empty]:
    return ok(Empty(), message=message)


def total_pages(total_records: int, page_size: int) -> int:
    return -(-total_records // page_size) if total_records > 0 else 0
