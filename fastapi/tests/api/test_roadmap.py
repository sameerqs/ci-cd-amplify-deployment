from collections.abc import Callable
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import FeedbackStatus, VoteChoice
from app.modules.roadmap.models import RoadmapItem, RoadmapVote
from app.modules.users.models import User

ITEMS = "/api/v1/roadmap-items"
SEEDED_TITLES = {
    "Pet Circle",
    "Local resources",
    "Longer voice notes",
    "Visit reminders",
}


@pytest.fixture
def make_item(session: AsyncSession) -> Callable[..., Any]:
    async def _make(
        title: str = "Wearable sync",
        description: str | None = None,
        is_active: bool = True,
        is_deleted: bool = False,
    ) -> RoadmapItem:
        item = RoadmapItem(
            title=title,
            description=description,
            is_active=is_active,
            is_deleted=is_deleted,
        )
        session.add(item)
        await session.flush()
        await session.refresh(item)
        return item

    return _make


@pytest.fixture
def cast_vote(session: AsyncSession) -> Callable[..., Any]:
    async def _cast(
        item: RoadmapItem, user: User, choice: VoteChoice, note: str | None = None
    ) -> RoadmapVote:
        vote = RoadmapVote(item_id=item.id, user_id=user.id, choice=choice, note=note)
        session.add(vote)
        await session.flush()
        return vote

    return _cast


async def test_migration_seeds_the_four_launch_items(session: AsyncSession) -> None:
    titles = set(
        (await session.execute(select(RoadmapItem.title).where(RoadmapItem.is_deleted.is_(False))))
        .scalars()
        .all()
    )
    assert titles >= SEEDED_TITLES


async def test_list_returns_seeded_items_with_zero_votes(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.get(ITEMS, headers=admin_headers)

    assert res.status_code == 200
    data = res.json()["data"]
    assert {row["title"] for row in data["items"]} >= SEEDED_TITLES
    assert all(row["yesCount"] == 0 and row["noCount"] == 0 for row in data["items"])


async def test_list_reports_vote_tallies_per_item(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
    plain_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    await cast_vote(item, admin_user, VoteChoice.YES)
    await cast_vote(item, plain_user, VoteChoice.NO)

    res = await client.get(ITEMS, headers=admin_headers, params={"search": "Wearable"})

    assert res.status_code == 200
    row = res.json()["data"]["items"][0]
    assert row["yesCount"] == 1
    assert row["noCount"] == 1


async def test_list_filters_by_is_active(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    await make_item(title="Parked idea", is_active=False)

    res = await client.get(ITEMS, headers=admin_headers, params={"isActive": "false"})

    assert res.status_code == 200
    data = res.json()["data"]
    assert [row["title"] for row in data["items"]] == ["Parked idea"]
    # why: the facet counts deliberately ignore the active filter.
    assert len(data["activeCounts"]) == 2


async def test_list_excludes_soft_deleted(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    await make_item(title="Scrapped", is_deleted=True)

    res = await client.get(ITEMS, headers=admin_headers, params={"search": "Scrapped"})

    assert res.json()["data"]["items"] == []


async def test_list_forbidden_for_plain_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.get(ITEMS, headers=user_headers)
    assert res.status_code == 403


async def test_create_item(
    client: AsyncClient, admin_headers: dict[str, str], admin_user: User
) -> None:
    res = await client.post(
        ITEMS,
        headers=admin_headers,
        json={"title": "Multi-pet timeline", "description": "One feed across every pet"},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["title"] == "Multi-pet timeline"
    assert data["isActive"] is True
    assert data["yesCount"] == 0
    assert data["createdById"] == str(admin_user.id)


async def test_create_rejects_a_duplicate_title_case_insensitively(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.post(ITEMS, headers=admin_headers, json={"title": "pet CIRCLE"})

    assert res.status_code == 409
    assert "already exists" in res.json()["errors"][0]["message"]


async def test_create_rejects_unknown_fields(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.post(ITEMS, headers=admin_headers, json={"title": "Nope", "votes": 3})
    assert res.status_code == 422


async def test_create_forbidden_for_plain_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.post(ITEMS, headers=user_headers, json={"title": "Sneaky"})
    assert res.status_code == 403


async def test_get_item_includes_tallies(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    await cast_vote(item, admin_user, VoteChoice.YES)

    res = await client.get(f"{ITEMS}/{item.id}", headers=admin_headers)

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["title"] == "Wearable sync"
    assert data["yesCount"] == 1
    assert data["noCount"] == 0


async def test_get_unknown_item_is_not_found(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.get(f"{ITEMS}/{uuid4()}", headers=admin_headers)
    assert res.status_code == 404


async def test_update_retitles_and_deactivates(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()

    res = await client.patch(
        f"{ITEMS}/{item.id}",
        headers=admin_headers,
        json={"title": "Wearable sync v2", "isActive": False},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["title"] == "Wearable sync v2"
    assert data["isActive"] is False
    assert data["updatedById"] == str(admin_user.id)


async def test_update_rejects_a_title_taken_by_another_item(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()

    res = await client.patch(
        f"{ITEMS}/{item.id}", headers=admin_headers, json={"title": "Pet Circle"}
    )

    assert res.status_code == 409


async def test_update_keeping_its_own_title_is_allowed(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()

    res = await client.patch(
        f"{ITEMS}/{item.id}",
        headers=admin_headers,
        json={"title": "Wearable sync", "isActive": False},
    )

    assert res.status_code == 200


async def test_update_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    res = await client.patch(f"{ITEMS}/{item.id}", headers=user_headers, json={"title": "Nope"})
    assert res.status_code == 403


async def test_delete_soft_deletes_and_deactivates(
    client: AsyncClient,
    admin_headers: dict[str, str],
    session: AsyncSession,
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    item_id: UUID = item.id

    res = await client.delete(f"{ITEMS}/{item_id}", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["data"]["isActive"] is False
    stored = await session.get(RoadmapItem, item_id)
    assert stored is not None
    assert stored.is_deleted is True


async def test_deleting_frees_the_title_for_reuse(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    await client.delete(f"{ITEMS}/{item.id}", headers=admin_headers)

    res = await client.post(ITEMS, headers=admin_headers, json={"title": "Wearable sync"})

    assert res.status_code == 200


async def test_delete_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    res = await client.delete(f"{ITEMS}/{item.id}", headers=user_headers)
    assert res.status_code == 403


async def test_one_vote_per_user_per_item_is_enforced(
    session: AsyncSession,
    admin_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    from sqlalchemy.exc import IntegrityError

    item = await make_item()
    await cast_vote(item, admin_user, VoteChoice.YES)

    with pytest.raises(IntegrityError):
        await cast_vote(item, admin_user, VoteChoice.NO)


async def test_votes_from_different_users_coexist(
    session: AsyncSession,
    admin_user: User,
    plain_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    await cast_vote(item, admin_user, VoteChoice.YES, note="Yes please")
    await cast_vote(item, plain_user, VoteChoice.NO)

    stored = (
        (await session.execute(select(RoadmapVote).where(RoadmapVote.item_id == item.id)))
        .scalars()
        .all()
    )
    assert len(stored) == 2
    assert {vote.choice for vote in stored} == {VoteChoice.YES, VoteChoice.NO}


async def test_list_feedback_reports_submissions_with_default_status(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    await cast_vote(item, admin_user, VoteChoice.YES, note="Would use this daily")

    res = await client.get(f"{ITEMS}/{item.id}/feedback", headers=admin_headers)

    assert res.status_code == 200
    row = res.json()["data"]["items"][0]
    assert row["userEmail"] == admin_user.email
    assert row["note"] == "Would use this daily"
    assert row["status"] == FeedbackStatus.NEW


async def test_list_feedback_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    res = await client.get(f"{ITEMS}/{item.id}/feedback", headers=user_headers)
    assert res.status_code == 403


async def test_update_feedback_status(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    vote = await cast_vote(item, admin_user, VoteChoice.YES, note="Sounds great")

    res = await client.patch(
        f"{ITEMS}/{item.id}/feedback/{vote.id}/status",
        headers=admin_headers,
        json={"status": FeedbackStatus.PLANNED},
    )

    assert res.status_code == 200
    assert res.json()["data"]["status"] == FeedbackStatus.PLANNED


async def test_update_feedback_status_unknown_feedback_is_not_found(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    res = await client.patch(
        f"{ITEMS}/{item.id}/feedback/{uuid4()}/status",
        headers=admin_headers,
        json={"status": FeedbackStatus.REVIEWED},
    )
    assert res.status_code == 404


async def test_update_feedback_status_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    admin_user: User,
    make_item: Callable[..., Any],
    cast_vote: Callable[..., Any],
) -> None:
    item = await make_item()
    vote = await cast_vote(item, admin_user, VoteChoice.YES)

    res = await client.patch(
        f"{ITEMS}/{item.id}/feedback/{vote.id}/status",
        headers=user_headers,
        json={"status": FeedbackStatus.REVIEWED},
    )
    assert res.status_code == 403
