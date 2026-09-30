"""PET-8. The rules the product cannot break, asserted at the seam.

These are not prompt-quality tests -- they prove the service does not depend on
the model behaving. Even a model that returns advice on an emergency turn cannot
get that advice in front of an owner. Cost/price commentary on a vet receipt is
now an intended feature, not a forbidden topic -- only the diagnosis/treatment
line and the fixed emergency notice are non-negotiable.
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Species
from app.modules.chat.models import CapturedEntry
from app.modules.chat.prompts import (
    EMERGENCY_LINE,
    SYSTEM_PROMPT,
    AssistantTurn,
    ExtractedEntry,
)
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers
from tests.api.test_chat import FakeChatModel, chat_url

pytest_plugins = ["tests.api.test_chat"]


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


async def test_an_emergency_reply_is_the_fixed_line_not_the_models_words(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    # A model that ignores its instructions and offers advice anyway.
    fake_model(
        [
            AssistantTurn(
                reply="That sounds like shock. Give him sugar water and wait an hour.",
                is_emergency=True,
            )
        ]
    )

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "his gums look pale and he's breathing strangely"},
    )

    last = res.json()["data"]["messages"][-1]
    assert last["body"] == EMERGENCY_LINE
    assert "sugar water" not in last["body"]
    assert last["isEmergencyNotice"] is True


async def test_an_emergency_turn_still_captures(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    """PET-8 revised: an emergency is exactly when the record matters.

    An emergency turn used to capture nothing at all, so the one turn an owner
    would be repeating to a vet within the hour was the only turn pet2text wrote
    nothing down for.
    """
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(
                reply="ignored",
                is_emergency=True,
                entries=[ExtractedEntry(category="Your concern", text="pale gums")],
            )
        ]
    )

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "pale gums"},
    )

    card = res.json()["data"]["card"]
    assert card is not None
    assert card["groups"][0]["entries"][0]["text"] == "pale gums"
    rows = (
        (await session.execute(select(CapturedEntry).where(CapturedEntry.pet_id == pet.id)))
        .scalars()
        .all()
    )
    assert len(rows) == 1


async def test_the_notice_fires_once_then_the_model_answers_in_context(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    """The reported bug: four identical red alarms and no way out.

    Every flagged turn re-sent EMERGENCY_LINE, so an owner mid-crisis could not
    ask, add anything, or even check the app was alive -- "are you here?" got the
    alarm too. The notice now opens the episode and the model answers the actual
    question after it; rule 1 is what keeps advice out, on every turn.
    """
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(reply="ignored", is_emergency=True),
            AssistantTurn(reply="I can't say how long it should take.", is_emergency=True),
            AssistantTurn(reply="I'm here.", is_emergency=True),
        ]
    )

    bodies = ["a kitten is stuck", "how long does this normally take?", "are you here?"]
    replies = []
    for body in bodies:
        res = await client.post(
            chat_url(pet.id, "/messages"),
            headers=auth_headers(plain_user),
            data={"body": body},
        )
        replies.append(res.json()["data"]["messages"][-1])

    assert replies[0]["body"] == EMERGENCY_LINE
    assert replies[0]["isEmergencyNotice"] is True
    assert replies[1]["body"] == "I can't say how long it should take."
    assert replies[2]["body"] == "I'm here."
    # why: only the opening notice is the red alert. Styling every later turn as
    # one is the alarm fatigue this fix exists to remove.
    for later in replies[1:]:
        assert later["body"] != EMERGENCY_LINE
        assert later["isEmergencyNotice"] is False


async def test_a_later_separate_emergency_raises_a_fresh_notice(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    """Suppression must not be permanent -- one ordinary turn closes the episode."""
    pet = await make_pet(plain_user)
    fake_model(
        [
            AssistantTurn(reply="x", is_emergency=True),
            AssistantTurn(reply="Which clinic was it?"),
            AssistantTurn(reply="x", is_emergency=True),
        ]
    )

    replies = []
    for body in ("he collapsed", "we saw the vet", "he collapsed again"):
        res = await client.post(
            chat_url(pet.id, "/messages"),
            headers=auth_headers(plain_user),
            data={"body": body},
        )
        replies.append(res.json()["data"]["messages"][-1])

    assert replies[0]["body"] == EMERGENCY_LINE
    assert replies[1]["body"] == "Which clinic was it?"
    assert replies[2]["body"] == EMERGENCY_LINE
    assert replies[2]["isEmergencyNotice"] is True


async def test_a_normal_turn_is_not_marked_as_an_emergency(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model([AssistantTurn(reply="Which clinic was it?")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "we went to the vet"},
    )

    last = res.json()["data"]["messages"][-1]
    assert last["isEmergencyNotice"] is False
    assert last["body"] == "Which clinic was it?"


async def test_the_system_prompt_forbids_diagnosis_and_treatment_calls() -> None:
    lowered = SYSTEM_PROMPT.lower()
    assert "never diagnose" in lowered
    assert "dosage" in lowered
    assert "already prescribed" in lowered
    assert "not your call" in lowered


async def test_the_system_prompt_allows_cost_context() -> None:
    lowered = SYSTEM_PROMPT.lower()
    assert "cost context" in lowered
    assert "never as an accusation" in lowered


async def test_the_system_prompt_names_emergency_signs_and_the_stop_rule() -> None:
    lowered = SYSTEM_PROMPT.lower()
    for sign in ("breathing", "collapse", "seizure", "bleeding", "poisoning"):
        assert sign in lowered
    assert "is_emergency" in lowered


async def test_the_emergency_line_gives_no_advice_and_defers_to_a_vet() -> None:
    lowered = EMERGENCY_LINE.lower()
    assert "vet" in lowered
    # It must not tell the owner what to do beyond seeking care.
    for advice_word in ("give", "dose", "apply", "wait", "try"):
        assert advice_word not in lowered


async def test_the_model_is_told_never_to_invent_entries() -> None:
    lowered = SYSTEM_PROMPT.lower()
    assert "never invent" in lowered
    assert "only concrete things the owner actually said" in lowered


async def test_the_pet_and_live_categories_reach_the_model(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user, name="Sana")
    model = fake_model([AssistantTurn(reply="ok")])

    await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "hello"},
    )

    prompt = model.structured.prompts[0]
    joined = " ".join(str(m.content) for m in prompt)
    assert "Sana" in joined
    assert "Vet visit" in joined
    assert "never diagnose" in joined.lower()
