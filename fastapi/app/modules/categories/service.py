from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.envelope import total_pages
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageQuery, apply_page, apply_sort
from app.modules.categories.constants import DEFAULT_ORDER, SORTABLE
from app.modules.categories.models import Category
from app.modules.categories.schemas import (
    ActiveCount,
    CategoriesPage,
    CategoryOut,
    CategoryPickerOption,
    CreateCategoryIn,
    UpdateCategoryIn,
)

NAME_TAKEN = "A category with this name already exists."


def get_category_filters(
    is_active: Annotated[bool | None, Query(alias="isActive")] = None,
) -> bool | None:
    return is_active


CategoryFiltersDep = Annotated[bool | None, Depends(get_category_filters)]


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _list_clauses(page: PageQuery, is_active: bool | None) -> list[ColumnElement[bool]]:
    clauses: list[ColumnElement[bool]] = [Category.is_deleted.is_(False)]
    if page.search:
        pattern = f"%{_escape_like(page.search)}%"
        clauses.append(
            or_(
                Category.name.ilike(pattern, escape="\\"),
                Category.description.ilike(pattern, escape="\\"),
            )
        )
    if is_active is not None:
        clauses.append(Category.is_active.is_(is_active))
    return clauses


async def list_categories(
    session: AsyncSession, page: PageQuery, is_active: bool | None
) -> CategoriesPage:
    clauses = _list_clauses(page, is_active)
    stmt = apply_page(
        apply_sort(select(Category).where(*clauses), page.sort, SORTABLE, DEFAULT_ORDER), page
    )
    items = (await session.execute(stmt)).scalars().all()
    total = await session.scalar(select(func.count()).select_from(Category).where(*clauses)) or 0
    # why: the facet counts ignore the isActive filter so switching tabs keeps both badges honest.
    count_clauses = _list_clauses(page, None)
    active_rows = (
        await session.execute(
            select(Category.is_active, func.count())
            .where(*count_clauses)
            .group_by(Category.is_active)
        )
    ).all()
    return CategoriesPage(
        items=[CategoryOut.model_validate(row) for row in items],
        page=page.page,
        page_size=page.page_size,
        total_records=total,
        total_pages=total_pages(total, page.page_size),
        active_counts=[
            ActiveCount(is_active=is_active_value, count=count)
            for is_active_value, count in active_rows
        ],
    )


async def list_picker(session: AsyncSession) -> list[CategoryPickerOption]:
    rows = (
        await session.execute(
            select(Category)
            .where(Category.is_deleted.is_(False), Category.is_active.is_(True))
            .order_by(*DEFAULT_ORDER)
        )
    ).scalars()
    return [CategoryPickerOption(id=row.id, name=row.name) for row in rows]


async def _load(session: AsyncSession, category_id: UUID) -> Category:
    category = await session.scalar(
        select(Category).where(Category.id == category_id, Category.is_deleted.is_(False))
    )
    if category is None:
        raise NotFoundError("Category not found")
    return category


async def read_category(session: AsyncSession, category_id: UUID) -> CategoryOut:
    return CategoryOut.model_validate(await _load(session, category_id))


async def _persist(session: AsyncSession, category: Category) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        # why: the pre-check loses to a concurrent write; the partial unique index is the real
        # guard, so a race must still read as a conflict rather than a 500.
        await session.rollback()
        raise ConflictError(NAME_TAKEN) from exc
    await session.refresh(category)
    await session.commit()


async def _assert_name_free(
    session: AsyncSession, name: str, exclude_id: UUID | None = None
) -> None:
    stmt = select(Category.id).where(
        func.lower(Category.name) == name.lower(), Category.is_deleted.is_(False)
    )
    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise ConflictError(NAME_TAKEN)


async def create_category(
    session: AsyncSession, payload: CreateCategoryIn, current_user_id: UUID
) -> CategoryOut:
    await _assert_name_free(session, payload.name)
    category = Category(
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        created_by_id=current_user_id,
        updated_by_id=current_user_id,
    )
    session.add(category)
    await _persist(session, category)
    return CategoryOut.model_validate(category)


async def update_category(
    session: AsyncSession, category_id: UUID, payload: UpdateCategoryIn, current_user_id: UUID
) -> CategoryOut:
    category = await _load(session, category_id)
    changes = payload.model_dump(exclude_unset=True)
    name = changes.pop("name", None)
    if name is not None:
        await _assert_name_free(session, name, exclude_id=category.id)
        category.name = name
    for field, value in changes.items():
        setattr(category, field, value)
    category.updated_by_id = current_user_id
    await _persist(session, category)
    return CategoryOut.model_validate(category)


async def soft_delete_category(
    session: AsyncSession, category_id: UUID, current_user_id: UUID
) -> CategoryOut:
    category = await _load(session, category_id)
    category.is_deleted = True
    category.is_active = False
    category.updated_by_id = current_user_id
    await _persist(session, category)
    return CategoryOut.model_validate(category)
