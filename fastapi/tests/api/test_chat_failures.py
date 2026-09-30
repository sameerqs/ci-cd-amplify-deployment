"""What the chat does when the language model does not cooperate.

None of these paths had coverage: the model always answered in tests, so a real
failure lost the owner's message without anyone noticing.
"""

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MessageAuthor, Species
from app.core.llm import get_chat_model_provider
from app.main import app
from app.modules.chat.models import ChatMessage
from app.modules.chat.prompts import AssistantTurn
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers


class BrokenStructuredModel:
    def __init__(self, behaviour: str) -> None:
        self.behaviour = behaviour
        self.calls = 0

    async def ainvoke(self, _prompt: Any) -> Any:
        self.calls += 1
        if self.behaviour == "raise":
            raise TimeoutError("upstream took too long")
        if self.behaviour == "none":
            return None
        if self.behaviour == "empty":
            return AssistantTurn(reply="   ")
        if self.behaviour == "garbage":
            return {"not": "a turn"}
        raise AssertionError(self.behaviour)


class BrokenChatModel:
    def __init__(self, behaviour: str) -> None:
        self.structured = BrokenStructuredModel(behaviour)

    def with_structured_output(self, _schema: Any) -> BrokenStructuredModel:
        return self.structured


@pytest.fixture
def broken_model() -> Iterator[Callable[[str], BrokenChatModel]]:
    def _install(behaviour: str) -> BrokenChatModel:
        model = BrokenChatModel(behaviour)
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
            created_by_id=owner.id,
            updated_by_id=owner.id,
        )
        session.add(pet)
        await session.flush()
        await session.refresh(pet)
        return pet

    return _make


def send_url(pet_id: Any) -> str:
    return f"/api/v1/pets/{pet_id}/chat/messages"


async def _owner_messages(session: AsyncSession, text: str) -> list[ChatMessage]:
    rows = await session.execute(
        select(ChatMessage).where(
            ChatMessage.author == MessageAuthor.OWNER, ChatMessage.body == text
        )
    )
    return list(rows.scalars())


@pytest.mark.parametrize("behaviour", ["raise", "none", "empty", "garbage"])
async def test_the_owners_message_survives_every_model_failure(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
    broken_model: Callable[[str], BrokenChatModel],
    behaviour: str,
) -> None:
    # why: the message used to be flushed in the same transaction as the model
    # call and rolled back with it, so what the owner typed disappeared and there
    # was nothing to retry from.
    broken_model(behaviour)
    pet = await make_pet(plain_user)

    res = await client.post(
        send_url(pet.id),
        data={"body": "He is off his food"},
        headers=auth_headers(plain_user),
    )

    assert res.status_code == 200, res.text
    kept = await _owner_messages(session, "He is off his food")
    assert len(kept) == 1


@pytest.mark.parametrize("behaviour", ["raise", "none", "empty", "garbage"])
async def test_a_failed_turn_adds_no_assistant_message(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
    broken_model: Callable[[str], BrokenChatModel],
    behaviour: str,
) -> None:
    broken_model(behaviour)
    pet = await make_pet(plain_user)

    res = await client.post(
        send_url(pet.id), data={"body": "Anything"}, headers=auth_headers(plain_user)
    )

    assert res.status_code == 200
    bodies = [m["body"] for m in res.json()["data"]["messages"]]
    # An empty or malformed reply must never be saved as a blank bubble.
    assert "" not in bodies
    assert "   " not in bodies


async def test_model_failure_does_not_leak_the_provider_to_the_client(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    broken_model: Callable[[str], BrokenChatModel],
) -> None:
    broken_model("raise")
    pet = await make_pet(plain_user)

    res = await client.post(
        send_url(pet.id), data={"body": "Anything"}, headers=auth_headers(plain_user)
    )

    text = res.text.lower()
    for leak in ("openai", "timeout", "upstream took too long", "traceback", "api_key"):
        assert leak not in text


async def test_chat_is_unavailable_not_broken_without_an_api_key(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import llm
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    llm.get_chat_model.cache_clear()
    pet = await make_pet(plain_user)

    res = await client.post(
        send_url(pet.id), data={"body": "Anything"}, headers=auth_headers(plain_user)
    )

    assert res.status_code == 503
    assert res.json()["isSuccess"] is False
    assert "not configured" in res.json()["message"].lower()
