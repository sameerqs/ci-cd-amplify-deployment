from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Annotated, Any, Literal, cast

from fastapi import Depends, Query
from sqlalchemy import Select
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import BadRequestError

SortDirection = Literal["asc", "desc"]
DEFAULT_PAGE_SIZE = 15
MAX_PAGE_SIZE = 100
MAX_SEARCH_LENGTH = 200
Sortable = Mapping[str, tuple[InstrumentedAttribute[Any], ...]]


@dataclass(frozen=True, slots=True)
class SortSpec:
    field: str
    direction: SortDirection


@dataclass(frozen=True, slots=True)
class PageQuery:
    page: int = 1
    page_size: int = DEFAULT_PAGE_SIZE
    search: str | None = None
    sort: tuple[SortSpec, ...] = ()

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def parse_sort(raw: str | None) -> tuple[SortSpec, ...]:
    if not raw:
        return ()
    specs: list[SortSpec] = []
    for item in raw.split(","):
        field_name, _, direction = item.strip().partition(":")
        field_name = field_name.strip()
        direction = (direction.strip() or "asc").lower()
        if not field_name:
            continue
        if direction not in ("asc", "desc"):
            raise BadRequestError(
                f"Invalid sort direction {direction!r} for {field_name!r}; use asc or desc"
            )
        specs.append(SortSpec(field_name, cast(SortDirection, direction)))
    return tuple(specs)


def get_page_query(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    search: Annotated[str | None, Query(max_length=MAX_SEARCH_LENGTH)] = None,
    sort: Annotated[str | None, Query()] = None,
) -> PageQuery:
    cleaned = search.strip() if search else None
    return PageQuery(page=page, page_size=page_size, search=cleaned or None, sort=parse_sort(sort))


PageQueryDep = Annotated[PageQuery, Depends(get_page_query)]


def apply_sort(
    stmt: Select[Any],
    sort: Sequence[SortSpec],
    sortable: Sortable,
    default: Sequence[ColumnElement[Any]],
) -> Select[Any]:
    if not sort:
        return stmt.order_by(*default)
    clauses: list[ColumnElement[Any]] = []
    for spec in sort:
        columns = sortable.get(spec.field)
        if columns is None:
            raise BadRequestError(f"Unsupported sort field {spec.field!r}")
        clauses.extend(col.asc() if spec.direction == "asc" else col.desc() for col in columns)
    return stmt.order_by(*clauses)


def apply_page(stmt: Select[Any], page: PageQuery) -> Select[Any]:
    return stmt.offset(page.offset).limit(page.page_size)
