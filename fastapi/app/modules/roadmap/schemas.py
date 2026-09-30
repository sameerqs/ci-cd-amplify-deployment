from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BeforeValidator, StringConstraints

from app.core.enums import FeedbackStatus, VoteChoice
from app.core.envelope import PaginatedData
from app.core.schemas import InputSchema, OutputSchema
from app.modules.roadmap.constants import (
    MAX_DESCRIPTION_LENGTH,
    MAX_PROMPT_LENGTH,
    MAX_TITLE_LENGTH,
)


def _empty_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


ItemTitle = Annotated[str, StringConstraints(min_length=1, max_length=MAX_TITLE_LENGTH)]
VoteNote = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=500)] | None,
    BeforeValidator(_empty_to_none),
]
ItemDescription = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=MAX_DESCRIPTION_LENGTH)] | None,
    BeforeValidator(_empty_to_none),
]
CommentPrompt = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=MAX_PROMPT_LENGTH)] | None,
    BeforeValidator(_empty_to_none),
]


class RoadmapItemOut(OutputSchema):
    id: UUID
    title: str
    description: str | None
    comment_prompt: str | None
    is_active: bool
    yes_count: int
    no_count: int
    created_by_id: UUID | None
    updated_by_id: UUID | None
    created_at: datetime
    updated_at: datetime | None


class CreateRoadmapItemIn(InputSchema):
    title: ItemTitle
    description: ItemDescription = None
    comment_prompt: CommentPrompt = None
    is_active: bool = True


class UpdateRoadmapItemIn(InputSchema):
    title: ItemTitle | None = None
    description: ItemDescription = None
    comment_prompt: CommentPrompt = None
    is_active: bool | None = None


class ActiveCount(OutputSchema):
    is_active: bool
    count: int


class RoadmapItemsPage(PaginatedData[RoadmapItemOut]):
    active_counts: list[ActiveCount]


class MyVoteOut(OutputSchema):
    """A roadmap item as the owner sees it on What's Coming (design 2j)."""

    id: UUID
    title: str
    description: str | None
    comment_prompt: str | None
    my_vote: VoteChoice | None
    note: str | None


class RoadmapFeedbackOut(OutputSchema):
    id: UUID
    user_email: str
    choice: VoteChoice
    note: str | None
    status: FeedbackStatus
    created_at: datetime
    updated_at: datetime | None


class CastVoteIn(InputSchema):
    choice: VoteChoice
    note: VoteNote = None


class UpdateFeedbackStatusIn(InputSchema):
    status: FeedbackStatus
