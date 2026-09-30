from collections.abc import Callable, Iterator
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MessageAuthor, Species
from app.core.llm import get_chat_model_provider
from app.main import app
from app.modules.chat.models import CapturedEntry, ChatMessage
from app.modules.chat.prompts import AssistantTurn, ExtractedEntry
from app.modules.chat.router import NOTHING_TO_SEND
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole


class FakeStructuredModel:
    """Stands in for `model.with_structured_output(AssistantTurn)`."""

    def __init__(self, turns: list[AssistantTurn]) -> None:
        self.turns = turns
        self.prompts: list[Any] = []

    async def ainvoke(self, prompt: Any) -> AssistantTurn:
        self.prompts.append(prompt)
        return self.turns.pop(0) if self.turns else AssistantTurn(reply="ok")


class FakeChatModel:
    def __init__(self, turns: list[AssistantTurn]) -> None:
        self.structured = FakeStructuredModel(turns)

    def with_structured_output(self, _schema: Any) -> FakeStructuredModel:
        return self.structured


@pytest.fixture
def fake_model() -> Iterator[Callable[[list[AssistantTurn]], FakeChatModel]]:
    def _install(turns: list[AssistantTurn]) -> FakeChatModel:
        model = FakeChatModel(turns)
        app.dependency_overrides[get_chat_model_provider] = lambda: lambda: model
        return model

    yield _install
    app.dependency_overrides.pop(get_chat_model_provider, None)


@pytest.fixture
def make_pet(session: AsyncSession) -> Callable[..., Any]:
    async def _make(owner: User, name: str = "Milo") -> Pet:
        pet = Pet(
            owner_id=owner.id,
            name=name,
            species=Species.DOG,
            breed="Beagle mix",
            age="7 yrs",
            created_by_id=owner.id,
            updated_by_id=owner.id,
        )
        session.add(pet)
        await session.flush()
        await session.refresh(pet)
        return pet

    return _make


def chat_url(pet_id: Any, suffix: str = "") -> str:
    return f"/api/v1/pets/{pet_id}/chat{suffix}"


async def test_opening_a_chat_greets_by_name(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)

    res = await client.get(chat_url(pet.id), headers=auth_headers(plain_user))

    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["messages"]) == 1
    assert data["messages"][0]["author"] == int(MessageAuthor.ASSISTANT)
    assert "Milo" in data["messages"][0]["body"]
    assert data["card"] is None


async def test_opening_twice_reuses_the_same_conversation(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)

    first = await client.get(chat_url(pet.id), headers=headers)
    second = await client.get(chat_url(pet.id), headers=headers)

    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert len(second.json()["data"]["messages"]) == 1


async def test_chat_history_returns_latest_fifty_and_loads_older_cursor_page(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    opened = await client.get(chat_url(pet.id), headers=auth_headers(plain_user))
    conversation_id = opened.json()["data"]["id"]
    for ordinal in range(2, 57):
        session.add(
            ChatMessage(
                conversation_id=conversation_id,
                ordinal=ordinal,
                author=MessageAuthor.OWNER,
                body=f"message {ordinal}",
                created_by_id=plain_user.id,
                updated_by_id=plain_user.id,
            )
        )
    await session.flush()

    latest = await client.get(chat_url(pet.id), headers=auth_headers(plain_user))
    latest_data = latest.json()["data"]
    assert len(latest_data["messages"]) == 50
    assert latest_data["hasMoreMessages"] is True

    older = await client.get(
        chat_url(pet.id, f"/messages?before={latest_data['nextBefore']}"),
        headers=auth_headers(plain_user),
    )
    older_data = older.json()["data"]
    assert len(older_data["messages"]) == 6
    assert older_data["hasMoreMessages"] is False


async def test_another_owners_chat_is_not_found(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    roles: None,
    make_pet: Callable[..., Any],
) -> None:
    other = await create_user(
        session,
        email="other@example.com",
        role=UserRole.USER,
    )
    pet = await make_pet(other)

    res = await client.get(chat_url(pet.id), headers=auth_headers(plain_user))

    assert res.status_code == 404


async def test_sending_a_message_records_both_turns(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model([AssistantTurn(reply="Has he seen a vet yet?")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "He's off his food."},
    )

    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()["data"]["messages"]]
    assert "He's off his food." in bodies
    assert "Has he seen a vet yet?" in bodies


async def test_extracted_entries_become_a_pending_card(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="Got it.",
                entries=[
                    ExtractedEntry(category="Your concern", text="Off his food 3 days"),
                    ExtractedEntry(category="Vet visit", text="Bloodwork and fluids"),
                ],
            )
        ]
    )

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "Off his food, saw the vet."},
    )

    card = res.json()["data"]["card"]
    assert card is not None
    assert card["isConfirmed"] is False
    categories = {g["category"] for g in card["groups"]}
    assert categories == {"Your concern", "Vet visit"}
    assert all(
        e["provenance"].startswith("you said,") for g in card["groups"] for e in g["entries"]
    )


async def test_an_unknown_category_is_dropped_not_misfiled(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="Got it.",
                entries=[
                    ExtractedEntry(category="Invented", text="nope"),
                    ExtractedEntry(category="Other", text="kept"),
                ],
            )
        ]
    )

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "something"},
    )

    card = res.json()["data"]["card"]
    assert [g["category"] for g in card["groups"]] == ["Other"]


async def test_confirming_the_card_stamps_every_entry(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="Got it.",
                entries=[ExtractedEntry(category="Other", text="a thing")],
            )
        ]
    )
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "x"})

    res = await client.post(chat_url(pet.id, "/card/confirm"), headers=headers)

    assert res.json()["data"]["card"]["isConfirmed"] is True
    rows = (
        (await session.execute(select(CapturedEntry).where(CapturedEntry.pet_id == pet.id)))
        .scalars()
        .all()
    )
    assert all(r.confirmed_at is not None for r in rows)


async def test_undo_clears_the_confirmation(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="Got it.",
                entries=[ExtractedEntry(category="Other", text="a thing")],
            )
        ]
    )
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "x"})
    await client.post(chat_url(pet.id, "/card/confirm"), headers=headers)

    res = await client.post(chat_url(pet.id, "/card/undo"), headers=headers)

    assert res.json()["data"]["card"]["isConfirmed"] is False


async def test_a_suggested_question_is_returned_for_a_declined_ask(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="That one I have to leave alone.",
                suggested_question="Can you walk me through the $180 bloodwork line?",
            )
        ]
    )

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "is $180 normal for bloodwork?"},
    )

    assert "bloodwork line" in res.json()["data"]["suggestedQuestion"]


async def test_a_turn_carrying_neither_text_nor_a_file_is_rejected(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    """400, not 422: empty is a legal body now -- a photo alone is a whole turn.

    What is rejected is a submit that carried nothing at all, which is a rule
    about the turn rather than about the shape of the form.
    """
    pet = await make_pet(plain_user)
    res = await client.post(
        chat_url(pet.id, "/messages"), headers=auth_headers(plain_user), data={"body": "   "}
    )
    assert res.status_code == 400
    assert res.json()["message"] == NOTHING_TO_SEND


async def test_chat_on_an_unknown_pet_is_not_found(client: AsyncClient, plain_user: User) -> None:
    res = await client.get(chat_url(uuid4()), headers=auth_headers(plain_user))
    assert res.status_code == 404


async def test_chat_requires_authentication(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)
    assert (await client.get(chat_url(pet.id))).status_code == 401
