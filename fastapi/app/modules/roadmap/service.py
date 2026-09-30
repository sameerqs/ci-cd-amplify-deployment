from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from sqlalchemy import ColumnElement, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.analytics import track
from app.core.enums import FeedbackStatus, VoteChoice
from app.core.envelope import total_pages
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageQuery, apply_page, apply_sort
from app.modules.roadmap.constants import DEFAULT_ORDER, SORTABLE
from app.modules.roadmap.models import RoadmapItem, RoadmapVote
from app.modules.roadmap.schemas import (
    ActiveCount,
    CastVoteIn,
    CreateRoadmapItemIn,
    MyVoteOut,
    RoadmapFeedbackOut,
    RoadmapItemOut,
    RoadmapItemsPage,
    UpdateRoadmapItemIn,
)
from app.modules.users.models import User

TITLE_TAKEN = "A roadmap item with this title already exists."


def get_roadmap_filters(
    is_active: Annotated[bool | None, Query(alias="isActive")] = None,
) -> bool | None:
    return is_active


RoadmapFiltersDep = Annotated[bool | None, Depends(get_roadmap_filters)]


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _vote_count(choice: VoteChoice) -> ColumnElement[int]:
    return (
        select(func.count())
        .select_from(RoadmapVote)
        .where(RoadmapVote.item_id == RoadmapItem.id, RoadmapVote.choice == choice)
        .correlate(RoadmapItem)
        .scalar_subquery()
    )


def _list_clauses(page: PageQuery, is_active: bool | None) -> list[ColumnElement[bool]]:
    clauses: list[ColumnElement[bool]] = [RoadmapItem.is_deleted.is_(False)]
    if page.search:
        pattern = f"%{_escape_like(page.search)}%"
        clauses.append(
            or_(
                RoadmapItem.title.ilike(pattern, escape="\\"),
                RoadmapItem.description.ilike(pattern, escape="\\"),
            )
        )
    if is_active is not None:
        clauses.append(RoadmapItem.is_active.is_(is_active))
    return clauses


def _to_out(item: RoadmapItem, yes_count: int, no_count: int) -> RoadmapItemOut:
    return RoadmapItemOut(
        id=item.id,
        title=item.title,
        description=item.description,
        comment_prompt=item.comment_prompt,
        is_active=item.is_active,
        yes_count=yes_count,
        no_count=no_count,
        created_by_id=item.created_by_id,
        updated_by_id=item.updated_by_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def list_items(
    session: AsyncSession, page: PageQuery, is_active: bool | None
) -> RoadmapItemsPage:
    clauses = _list_clauses(page, is_active)
    stmt = apply_page(
        apply_sort(
            select(RoadmapItem, _vote_count(VoteChoice.YES), _vote_count(VoteChoice.NO)).where(
                *clauses
            ),
            page.sort,
            SORTABLE,
            DEFAULT_ORDER,
        ),
        page,
    )
    rows = (await session.execute(stmt)).all()
    total = await session.scalar(select(func.count()).select_from(RoadmapItem).where(*clauses)) or 0
    # why: the facet counts ignore the isActive filter so both badges stay honest across tabs.
    count_clauses = _list_clauses(page, None)
    active_rows = (
        await session.execute(
            select(RoadmapItem.is_active, func.count())
            .where(*count_clauses)
            .group_by(RoadmapItem.is_active)
        )
    ).all()
    return RoadmapItemsPage(
        items=[_to_out(item, yes, no) for item, yes, no in rows],
        page=page.page,
        page_size=page.page_size,
        total_records=total,
        total_pages=total_pages(total, page.page_size),
        active_counts=[
            ActiveCount(is_active=is_active_value, count=count)
            for is_active_value, count in active_rows
        ],
    )


async def _load(session: AsyncSession, item_id: UUID) -> RoadmapItem:
    item = await session.scalar(
        select(RoadmapItem).where(RoadmapItem.id == item_id, RoadmapItem.is_deleted.is_(False))
    )
    if item is None:
        raise NotFoundError("Roadmap item not found")
    return item


async def _counts_for(session: AsyncSession, item_id: UUID) -> tuple[int, int]:
    row = (
        await session.execute(
            select(
                func.count().filter(RoadmapVote.choice == VoteChoice.YES),
                func.count().filter(RoadmapVote.choice == VoteChoice.NO),
            ).where(RoadmapVote.item_id == item_id)
        )
    ).one()
    return int(row[0]), int(row[1])


async def read_item(session: AsyncSession, item_id: UUID) -> RoadmapItemOut:
    item = await _load(session, item_id)
    yes_count, no_count = await _counts_for(session, item.id)
    return _to_out(item, yes_count, no_count)


async def list_feedback(session: AsyncSession, item_id: UUID) -> list[RoadmapFeedbackOut]:
    await _load(session, item_id)
    rows = await session.execute(
        select(RoadmapVote, User.email)
        .join(User, User.id == RoadmapVote.user_id)
        .where(RoadmapVote.item_id == item_id)
        .order_by(RoadmapVote.updated_at.desc())
    )
    return [
        RoadmapFeedbackOut(
            id=vote.id,
            user_email=email,
            choice=vote.choice,
            note=vote.note,
            status=vote.status,
            created_at=vote.created_at,
            updated_at=vote.updated_at,
        )
        for vote, email in rows.all()
    ]


async def update_feedback_status(
    session: AsyncSession,
    item_id: UUID,
    vote_id: UUID,
    status: FeedbackStatus,
    current_user_id: UUID,
) -> RoadmapFeedbackOut:
    row = (
        await session.execute(
            select(RoadmapVote, User.email)
            .join(User, User.id == RoadmapVote.user_id)
            .where(RoadmapVote.id == vote_id, RoadmapVote.item_id == item_id)
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("Feedback not found")
    vote, email = row
    vote.status = status
    vote.updated_by_id = current_user_id
    await session.flush()
    await session.refresh(vote)
    await session.commit()
    return RoadmapFeedbackOut(
        id=vote.id,
        user_email=email,
        choice=vote.choice,
        note=vote.note,
        status=vote.status,
        created_at=vote.created_at,
        updated_at=vote.updated_at,
    )


async def _persist(session: AsyncSession, item: RoadmapItem) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        # why: the pre-check loses to a concurrent write; the partial unique index is the real
        # guard, so a race must still read as a conflict rather than a 500.
        await session.rollback()
        raise ConflictError(TITLE_TAKEN) from exc
    await session.refresh(item)
    await session.commit()


async def _assert_title_free(
    session: AsyncSession, title: str, exclude_id: UUID | None = None
) -> None:
    stmt = select(RoadmapItem.id).where(
        func.lower(RoadmapItem.title) == title.lower(), RoadmapItem.is_deleted.is_(False)
    )
    if exclude_id is not None:
        stmt = stmt.where(RoadmapItem.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise ConflictError(TITLE_TAKEN)


async def create_item(
    session: AsyncSession, payload: CreateRoadmapItemIn, current_user_id: UUID
) -> RoadmapItemOut:
    await _assert_title_free(session, payload.title)
    item = RoadmapItem(
        title=payload.title,
        description=payload.description,
        comment_prompt=payload.comment_prompt,
        is_active=payload.is_active,
        created_by_id=current_user_id,
        updated_by_id=current_user_id,
    )
    session.add(item)
    await _persist(session, item)
    return _to_out(item, 0, 0)


async def update_item(
    session: AsyncSession, item_id: UUID, payload: UpdateRoadmapItemIn, current_user_id: UUID
) -> RoadmapItemOut:
    item = await _load(session, item_id)
    changes = payload.model_dump(exclude_unset=True)
    title = changes.pop("title", None)
    if title is not None:
        await _assert_title_free(session, title, exclude_id=item.id)
        item.title = title
    for field, value in changes.items():
        setattr(item, field, value)
    item.updated_by_id = current_user_id
    await _persist(session, item)
    yes_count, no_count = await _counts_for(session, item.id)
    return _to_out(item, yes_count, no_count)


async def soft_delete_item(
    session: AsyncSession, item_id: UUID, current_user_id: UUID
) -> RoadmapItemOut:
    item = await _load(session, item_id)
    yes_count, no_count = await _counts_for(session, item.id)
    item.is_deleted = True
    item.is_active = False
    item.updated_by_id = current_user_id
    await _persist(session, item)
    return _to_out(item, yes_count, no_count)


async def list_for_owner(session: AsyncSession, user_id: UUID) -> list[MyVoteOut]:
    """Active items with the caller's own vote attached (design 2j).

    Tallies are deliberately not returned here: the owner screen shows what they
    picked, not how the crowd is leaning, so a vote cannot be anchored by one.
    """
    rows = (
        await session.execute(
            select(RoadmapItem, RoadmapVote)
            .outerjoin(
                RoadmapVote,
                (RoadmapVote.item_id == RoadmapItem.id) & (RoadmapVote.user_id == user_id),
            )
            .where(RoadmapItem.is_deleted.is_(False), RoadmapItem.is_active.is_(True))
            .order_by(*DEFAULT_ORDER)
        )
    ).all()
    return [
        MyVoteOut(
            id=item.id,
            title=item.title,
            description=item.description,
            comment_prompt=item.comment_prompt,
            my_vote=vote.choice if vote is not None else None,
            note=vote.note if vote is not None else None,
        )
        for item, vote in rows
    ]


async def _load_votable(session: AsyncSession, item_id: UUID) -> RoadmapItem:
    item = await session.scalar(
        select(RoadmapItem).where(
            RoadmapItem.id == item_id,
            RoadmapItem.is_deleted.is_(False),
            RoadmapItem.is_active.is_(True),
        )
    )
    if item is None:
        raise NotFoundError("Roadmap item not found")
    return item


async def cast_vote(
    session: AsyncSession, user_id: UUID, item_id: UUID, payload: CastVoteIn
) -> MyVoteOut:
    item = await _load_votable(session, item_id)
    vote = await session.scalar(
        select(RoadmapVote).where(RoadmapVote.item_id == item.id, RoadmapVote.user_id == user_id)
    )
    # why: one PUT covers both "changed my vote" and "just left a comment" --
    # the two tracked events are about which one actually happened, decided by
    # comparing against what was there before, not by the caller declaring it.
    choice_changed = vote is None or vote.choice != payload.choice
    note_changed = (vote.note if vote else None) != payload.note
    if vote is None:
        vote = RoadmapVote(
            item_id=item.id,
            user_id=user_id,
            choice=payload.choice,
            note=payload.note,
            created_by_id=user_id,
            updated_by_id=user_id,
        )
        session.add(vote)
    else:
        # why: one vote per person per item - changing your mind replaces the
        # row rather than stacking a second one behind the unique index.
        vote.choice = payload.choice
        vote.note = payload.note
        vote.updated_by_id = user_id
    await session.flush()
    await session.commit()
    if choice_changed:
        track("feature_vote_set", item_id=str(item.id), choice=payload.choice.name)
    if note_changed and payload.note:
        track("feature_comment_saved", item_id=str(item.id))
    return MyVoteOut(
        id=item.id,
        title=item.title,
        description=item.description,
        comment_prompt=item.comment_prompt,
        my_vote=vote.choice,
        note=vote.note,
    )


async def clear_vote(session: AsyncSession, user_id: UUID, item_id: UUID) -> MyVoteOut:
    item = await _load_votable(session, item_id)
    vote = await session.scalar(
        select(RoadmapVote).where(RoadmapVote.item_id == item.id, RoadmapVote.user_id == user_id)
    )
    if vote is not None:
        await session.delete(vote)
        await session.flush()
        await session.commit()
    return MyVoteOut(
        id=item.id,
        title=item.title,
        description=item.description,
        comment_prompt=item.comment_prompt,
        my_vote=None,
        note=None,
    )


async def scrub_notes_for_user(session: AsyncSession, user_id: UUID) -> None:
    """Blank every comment a deleted account left behind. The vote stands.

    why: a comment is free text and can carry personal detail the choice alone
    never does, so it is what account deletion has to remove -- the yes/no
    signal has no privacy weight on its own and stays, the same way the vote
    row itself is left in place rather than deleted, for the product's own
    count. Called from users.service.soft_delete_user, in the same transaction
    as the anonymisation, so the two never disagree about whether it happened.
    """
    await session.execute(
        update(RoadmapVote).where(RoadmapVote.user_id == user_id).values(note=None)
    )
