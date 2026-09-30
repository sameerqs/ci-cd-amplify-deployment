from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BeforeValidator, StringConstraints

from app.core.envelope import PaginatedData
from app.core.schemas import InputSchema, OutputSchema
from app.modules.categories.constants import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH


def _empty_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


CategoryName = Annotated[str, StringConstraints(min_length=1, max_length=MAX_NAME_LENGTH)]
CategoryDescription = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=MAX_DESCRIPTION_LENGTH)] | None,
    BeforeValidator(_empty_to_none),
]


class CategoryOut(OutputSchema):
    id: UUID
    name: str
    description: str | None
    is_active: bool
    created_by_id: UUID | None
    updated_by_id: UUID | None
    created_at: datetime
    updated_at: datetime | None


class CreateCategoryIn(InputSchema):
    name: CategoryName
    description: CategoryDescription = None
    is_active: bool = True


class UpdateCategoryIn(InputSchema):
    name: CategoryName | None = None
    description: CategoryDescription = None
    is_active: bool | None = None


class CategoryPickerOption(OutputSchema):
    id: UUID
    name: str


class ActiveCount(OutputSchema):
    is_active: bool
    count: int


class CategoriesPage(PaginatedData[CategoryOut]):
    active_counts: list[ActiveCount]
