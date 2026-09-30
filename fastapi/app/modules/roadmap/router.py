from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, SessionDep, require_super_admin
from app.core.envelope import ApiResponse, Items, ok, ok_items
from app.core.pagination import PageQueryDep
from app.modules.roadmap import service
from app.modules.roadmap.schemas import (
    CastVoteIn,
    CreateRoadmapItemIn,
    MyVoteOut,
    RoadmapFeedbackOut,
    RoadmapItemOut,
    RoadmapItemsPage,
    UpdateFeedbackStatusIn,
    UpdateRoadmapItemIn,
)
from app.modules.roadmap.service import RoadmapFiltersDep

router = APIRouter(prefix="/roadmap-items", tags=["Roadmap"])
admins_only = Depends(require_super_admin)

ITEM_CREATED = "Roadmap item created successfully"
ITEM_UPDATED = "Roadmap item updated successfully"
ITEM_DELETED = "Roadmap item deleted successfully"
FEEDBACK_STATUS_UPDATED = "Feedback status updated"


@router.get("", dependencies=[admins_only], summary="List roadmap items")
async def list_items(
    page: PageQueryDep, is_active: RoadmapFiltersDep, session: SessionDep
) -> ApiResponse[RoadmapItemsPage]:
    return ok(await service.list_items(session, page, is_active))


@router.post("", dependencies=[admins_only], summary="Create a roadmap item")
async def create_item(
    payload: CreateRoadmapItemIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[RoadmapItemOut]:
    created = await service.create_item(session, payload, user.id)
    return ok(created, message=ITEM_CREATED)


@router.get("/{item_id}", dependencies=[admins_only], summary="Get a roadmap item")
async def get_item(item_id: UUID, session: SessionDep) -> ApiResponse[RoadmapItemOut]:
    return ok(await service.read_item(session, item_id))


@router.get(
    "/{item_id}/feedback",
    dependencies=[admins_only],
    summary="Review feedback for a roadmap item",
)
async def list_feedback(
    item_id: UUID, session: SessionDep
) -> ApiResponse[Items[RoadmapFeedbackOut]]:
    return ok_items(await service.list_feedback(session, item_id))


@router.patch(
    "/{item_id}/feedback/{vote_id}/status",
    dependencies=[admins_only],
    summary="Update the status of a feedback submission",
)
async def update_feedback_status(
    item_id: UUID,
    vote_id: UUID,
    payload: UpdateFeedbackStatusIn,
    session: SessionDep,
    user: CurrentUser,
) -> ApiResponse[RoadmapFeedbackOut]:
    updated = await service.update_feedback_status(
        session, item_id, vote_id, payload.status, user.id
    )
    return ok(updated, message=FEEDBACK_STATUS_UPDATED)


@router.patch("/{item_id}", dependencies=[admins_only], summary="Update a roadmap item")
async def update_item(
    item_id: UUID, payload: UpdateRoadmapItemIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[RoadmapItemOut]:
    updated = await service.update_item(session, item_id, payload, user.id)
    return ok(updated, message=ITEM_UPDATED)


@router.delete("/{item_id}", dependencies=[admins_only], summary="Soft delete a roadmap item")
async def delete_item(
    item_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[RoadmapItemOut]:
    deleted = await service.soft_delete_item(session, item_id, user.id)
    return ok(deleted, message=ITEM_DELETED)


# why: the owner-facing surface is a separate prefix from /roadmap-items, which
# stays admin-only. Same tables, different audience and different payload.
owner_router = APIRouter(prefix="/whats-coming", tags=["Roadmap"])

VOTE_RECORDED = "Vote recorded"
VOTE_CLEARED = "Vote cleared"


@owner_router.get("", summary="Active items with your vote")
async def list_for_owner(session: SessionDep, user: CurrentUser) -> ApiResponse[Items[MyVoteOut]]:
    return ok_items(await service.list_for_owner(session, user.id))


@owner_router.put("/{item_id}/vote", summary="Cast or change a vote")
async def cast_vote(
    item_id: UUID, payload: CastVoteIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[MyVoteOut]:
    return ok(await service.cast_vote(session, user.id, item_id, payload), message=VOTE_RECORDED)


@owner_router.delete("/{item_id}/vote", summary="Withdraw a vote")
async def clear_vote(
    item_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[MyVoteOut]:
    return ok(await service.clear_vote(session, user.id, item_id), message=VOTE_CLEARED)
