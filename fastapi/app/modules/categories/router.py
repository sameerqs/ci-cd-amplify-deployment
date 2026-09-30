from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, SessionDep, require_super_admin
from app.core.envelope import ApiResponse, Items, ok, ok_items
from app.core.pagination import PageQueryDep
from app.modules.categories import service
from app.modules.categories.schemas import (
    CategoriesPage,
    CategoryOut,
    CategoryPickerOption,
    CreateCategoryIn,
    UpdateCategoryIn,
)
from app.modules.categories.service import CategoryFiltersDep

router = APIRouter(prefix="/categories", tags=["Categories"])
admins_only = Depends(require_super_admin)

CATEGORY_CREATED = "Category created successfully"
CATEGORY_UPDATED = "Category updated successfully"
CATEGORY_DELETED = "Category deleted successfully"


@router.get("", dependencies=[admins_only], summary="List categories")
async def list_categories(
    page: PageQueryDep, is_active: CategoryFiltersDep, session: SessionDep
) -> ApiResponse[CategoriesPage]:
    return ok(await service.list_categories(session, page, is_active))


# why: any signed-in user hits this - the chat extraction reads the live taxonomy, so it is
# unbounded per the picker rule.
@router.get("/picker", summary="Active categories for pickers")
async def category_picker(session: SessionDep) -> ApiResponse[Items[CategoryPickerOption]]:
    return ok_items(await service.list_picker(session))


@router.post("", dependencies=[admins_only], summary="Create a category")
async def create_category(
    payload: CreateCategoryIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[CategoryOut]:
    created = await service.create_category(session, payload, user.id)
    return ok(created, message=CATEGORY_CREATED)


@router.get("/{category_id}", dependencies=[admins_only], summary="Get a category")
async def get_category(category_id: UUID, session: SessionDep) -> ApiResponse[CategoryOut]:
    return ok(await service.read_category(session, category_id))


@router.patch("/{category_id}", dependencies=[admins_only], summary="Update a category")
async def update_category(
    category_id: UUID, payload: UpdateCategoryIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[CategoryOut]:
    updated = await service.update_category(session, category_id, payload, user.id)
    return ok(updated, message=CATEGORY_UPDATED)


@router.delete("/{category_id}", dependencies=[admins_only], summary="Soft delete a category")
async def delete_category(
    category_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[CategoryOut]:
    deleted = await service.soft_delete_category(session, category_id, user.id)
    return ok(deleted, message=CATEGORY_DELETED)
