import logging
from collections.abc import Callable
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import VoteChoice
from app.modules.roadmap import service as roadmap_service
from app.modules.roadmap.models import RoadmapItem, RoadmapVote
from app.modules.users.models import User
from app.modules.users.service import soft_delete_user
from tests.api.conftest import auth_headers, create_user

WHATS_COMING = "/api/v1/whats-coming"


def vote_url(item_id: Any) -> str:
    return f"{WHATS_COMING}/{item_id}/vote"


@pytest.fixture
def make_item(session: AsyncSession) -> Callable[..., Any]:
    async def _make(
        title: str = "Wearable sync",
        is_active: bool = True,
        is_deleted: bool = False,
        comment_prompt: str | None = None,
    ) -> RoadmapItem:
        item = RoadmapItem(
            title=title,
            description="d",
            comment_prompt=comment_prompt,
            is_active=is_active,
            is_deleted=is_deleted,
        )
        session.add(item)
        await session.flush()
        await session.refresh(item)
        return item

    return _make


async def test_list_returns_active_items_with_no_vote_initially(
    client: AsyncClient, plain_user: User
) -> None:
    res = await client.get(WHATS_COMING, headers=auth_headers(plain_user))

    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert {i["title"] for i in items} >= {"Pet Circle", "Local resources"}
    assert all(i["myVote"] is None for i in items)


async def test_list_hides_inactive_and_deleted_items(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    await make_item(title="Parked", is_active=False)
    await make_item(title="Scrapped", is_deleted=True)

    res = await client.get(WHATS_COMING, headers=auth_headers(plain_user))

    titles = {i["title"] for i in res.json()["data"]["items"]}
    assert "Parked" not in titles
    assert "Scrapped" not in titles


async def test_list_does_not_expose_tallies(client: AsyncClient, plain_user: User) -> None:
    res = await client.get(WHATS_COMING, headers=auth_headers(plain_user))

    first = res.json()["data"]["items"][0]
    assert "yesCount" not in first
    assert "noCount" not in first


async def test_casting_a_vote_records_choice_and_note(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()

    res = await client.put(
        vote_url(item.id),
        headers=auth_headers(plain_user),
        json={"choice": int(VoteChoice.YES), "note": "Would use it weekly"},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["myVote"] == int(VoteChoice.YES)
    assert data["note"] == "Would use it weekly"


async def test_changing_your_mind_replaces_the_vote(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    headers = auth_headers(plain_user)
    await client.put(vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES)})

    res = await client.put(vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.NO)})

    assert res.json()["data"]["myVote"] == int(VoteChoice.NO)
    rows = (
        (await session.execute(select(RoadmapVote).where(RoadmapVote.item_id == item.id)))
        .scalars()
        .all()
    )
    assert len(rows) == 1


async def test_note_can_be_cleared_on_a_revote(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()
    headers = auth_headers(plain_user)
    await client.put(
        vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES), "note": "x"}
    )

    res = await client.put(
        vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES), "note": ""}
    )

    assert res.json()["data"]["note"] is None


async def test_your_vote_comes_back_on_the_list(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()
    headers = auth_headers(plain_user)
    await client.put(vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES)})

    res = await client.get(WHATS_COMING, headers=headers)

    mine = next(i for i in res.json()["data"]["items"] if i["id"] == str(item.id))
    assert mine["myVote"] == int(VoteChoice.YES)


async def test_one_owners_vote_is_invisible_to_another(
    client: AsyncClient,
    plain_user: User,
    admin_user: User,
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    await client.put(
        vote_url(item.id),
        headers=auth_headers(plain_user),
        json={"choice": int(VoteChoice.YES)},
    )

    res = await client.get(WHATS_COMING, headers=auth_headers(admin_user))

    theirs = next(i for i in res.json()["data"]["items"] if i["id"] == str(item.id))
    assert theirs["myVote"] is None


async def test_clearing_a_vote_removes_the_row(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    headers = auth_headers(plain_user)
    await client.put(vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES)})

    res = await client.delete(vote_url(item.id), headers=headers)

    assert res.status_code == 200
    assert res.json()["data"]["myVote"] is None
    rows = (
        (await session.execute(select(RoadmapVote).where(RoadmapVote.item_id == item.id)))
        .scalars()
        .all()
    )
    assert rows == []


async def test_clearing_a_vote_you_never_cast_is_a_no_op(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()

    res = await client.delete(vote_url(item.id), headers=auth_headers(plain_user))

    assert res.status_code == 200
    assert res.json()["data"]["myVote"] is None


async def test_cannot_vote_on_an_inactive_item(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item(title="Parked", is_active=False)

    res = await client.put(
        vote_url(item.id),
        headers=auth_headers(plain_user),
        json={"choice": int(VoteChoice.YES)},
    )

    assert res.status_code == 404


async def test_cannot_vote_on_an_unknown_item(client: AsyncClient, plain_user: User) -> None:
    res = await client.put(
        vote_url(uuid4()),
        headers=auth_headers(plain_user),
        json={"choice": int(VoteChoice.YES)},
    )
    assert res.status_code == 404


async def test_vote_rejects_an_unknown_choice(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()
    res = await client.put(vote_url(item.id), headers=auth_headers(plain_user), json={"choice": 9})
    assert res.status_code == 422


async def test_owner_votes_show_up_in_the_admin_tallies(
    client: AsyncClient,
    plain_user: User,
    admin_headers: dict[str, str],
    make_item: Callable[..., Any],
) -> None:
    item = await make_item()
    await client.put(
        vote_url(item.id),
        headers=auth_headers(plain_user),
        json={"choice": int(VoteChoice.YES)},
    )

    res = await client.get(f"/api/v1/roadmap-items/{item.id}", headers=admin_headers)

    assert res.json()["data"]["yesCount"] == 1


async def test_whats_coming_requires_authentication(client: AsyncClient, roles: None) -> None:
    assert (await client.get(WHATS_COMING)).status_code == 401


async def test_the_comment_prompt_is_per_feature_not_generic(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item(title="Family sharing", comment_prompt="Who would you invite?")

    res = await client.get(WHATS_COMING, headers=auth_headers(plain_user))

    mine = next(i for i in res.json()["data"]["items"] if i["id"] == str(item.id))
    assert mine["commentPrompt"] == "Who would you invite?"


async def test_an_item_with_no_prompt_configured_returns_null(
    client: AsyncClient, plain_user: User, make_item: Callable[..., Any]
) -> None:
    item = await make_item()

    res = await client.get(WHATS_COMING, headers=auth_headers(plain_user))

    mine = next(i for i in res.json()["data"]["items"] if i["id"] == str(item.id))
    assert mine["commentPrompt"] is None


async def test_a_first_vote_logs_feature_vote_set_not_comment_saved(
    client: AsyncClient,
    plain_user: User,
    make_item: Callable[..., Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    item = await make_item()

    with caplog.at_level(logging.INFO, logger="app.analytics"):
        await client.put(
            vote_url(item.id),
            headers=auth_headers(plain_user),
            json={"choice": int(VoteChoice.YES)},
        )

    events = [r.event for r in caplog.records if r.name == "app.analytics"]  # type: ignore[attr-defined]
    assert "feature_vote_set" in events
    assert "feature_comment_saved" not in events


async def test_leaving_a_comment_without_changing_the_vote_logs_only_the_comment_event(
    client: AsyncClient,
    plain_user: User,
    make_item: Callable[..., Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    item = await make_item()
    headers = auth_headers(plain_user)
    await client.put(vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES)})

    # why: caplog accumulates for the whole test regardless of at_level's scope
    # -- the first vote above already logged feature_vote_set, so this clears
    # it rather than let the setup call's event leak into what gets asserted.
    caplog.clear()
    with caplog.at_level(logging.INFO, logger="app.analytics"):
        await client.put(
            vote_url(item.id), headers=headers, json={"choice": int(VoteChoice.YES), "note": "x"}
        )

    events = [r.event for r in caplog.records if r.name == "app.analytics"]  # type: ignore[attr-defined]
    assert events.count("feature_vote_set") == 0
    assert events.count("feature_comment_saved") == 1


async def test_deleting_the_account_scrubs_the_comment_but_keeps_the_vote(
    session: AsyncSession, make_item: Callable[..., Any]
) -> None:
    """PET-11's retention NFR: keep the vote for the count, drop the free text.

    why: routed at the service layer, not through the HTTP delete route -- that
    route sits behind role checks this branch's role removal has not finished
    reconciling, which is a separate, already-tracked problem from the one this
    test exists to prove.
    """
    owner = await create_user(session, email="scrub-me@example.com")
    item = await make_item()
    session.add(
        RoadmapVote(
            item_id=item.id,
            user_id=owner.id,
            choice=VoteChoice.YES,
            note="Would use it every week for the vet visits",
            created_by_id=owner.id,
            updated_by_id=owner.id,
        )
    )
    await session.flush()

    await soft_delete_user(session, owner.id, owner.id)

    vote = await session.scalar(
        select(RoadmapVote).where(RoadmapVote.item_id == item.id, RoadmapVote.user_id == owner.id)
    )
    assert vote is not None
    assert vote.note is None
    assert vote.choice == VoteChoice.YES


async def test_scrub_notes_only_touches_the_named_user(
    session: AsyncSession, make_item: Callable[..., Any]
) -> None:
    a = await create_user(session, email="a@example.com")
    b = await create_user(session, email="b@example.com")
    item = await make_item()
    session.add_all(
        [
            RoadmapVote(
                item_id=item.id,
                user_id=a.id,
                choice=VoteChoice.YES,
                note="a's note",
                created_by_id=a.id,
                updated_by_id=a.id,
            ),
            RoadmapVote(
                item_id=item.id,
                user_id=b.id,
                choice=VoteChoice.NO,
                note="b's note",
                created_by_id=b.id,
                updated_by_id=b.id,
            ),
        ]
    )
    await session.flush()

    await roadmap_service.scrub_notes_for_user(session, a.id)
    await session.commit()

    a_vote = await session.scalar(select(RoadmapVote).where(RoadmapVote.user_id == a.id))
    b_vote = await session.scalar(select(RoadmapVote).where(RoadmapVote.user_id == b.id))
    assert a_vote is not None and a_vote.note is None
    assert b_vote is not None and b_vote.note == "b's note"
