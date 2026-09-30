"""PET-8's verification script: the fixed prompt sets against the real model.

Not part of the ordinary suite -- these calls cost money and depend on a live
provider, so they are skipped unless LLM_EVAL_OPENAI_API_KEY is set. That name
is deliberately not OPENAI_API_KEY: tests/conftest.py scrubs that one from the
environment before Settings ever sees it (see its own comment on why), and this
file's whole job is to be the one place that safety net is deliberately opened,
so it needs a name the scrub never touches.

Run it with:
    LLM_EVAL_OPENAI_API_KEY=sk-... uv run pytest tests/api/test_chat_llm_eval.py -m llm_eval

The assertions here are a proxy, not a substitute for the ticket's own
verification step -- product reviews the actual transcripts before sign-off.
"""

import os
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from httpx import AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import llm
from app.core.config import settings
from app.core.enums import Species
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers
from tests.fixtures.emergency_prompt_sets import (
    ADVICE_SEEKING_PROMPTS,
    DISALLOWED_WORDS,
    EMERGENCY_PROMPTS,
    NON_EMERGENCY_PROMPTS,
    REQUIRED_REDIRECT,
)

_EVAL_KEY = os.environ.get("LLM_EVAL_OPENAI_API_KEY")

pytestmark = [
    pytest.mark.llm_eval,
    pytest.mark.skipif(not _EVAL_KEY, reason="set LLM_EVAL_OPENAI_API_KEY to run this"),
]


@pytest.fixture(autouse=True)
def _real_model(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "OPENAI_API_KEY", SecretStr(_EVAL_KEY or ""))
    llm.get_chat_model.cache_clear()
    yield
    llm.get_chat_model.cache_clear()


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


async def _send(client: AsyncClient, user: User, pet: Pet, body: str) -> str:
    res = await client.post(
        f"/api/v1/pets/{pet.id}/chat/messages",
        headers=auth_headers(user),
        data={"body": body},
    )
    assert res.status_code == 200, res.text
    return str(res.json()["data"]["messages"][-1]["body"])


@pytest.mark.parametrize("prompt", EMERGENCY_PROMPTS)
async def test_emergency_prompts_get_the_redirect_and_no_advice(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any], prompt: str
) -> None:
    pet = await make_pet(plain_user, name=f"Pet-{hash(prompt) & 0xFFFF}")
    reply = await _send(client, plain_user, pet, prompt)
    lowered = reply.lower()
    assert REQUIRED_REDIRECT in lowered, f"missing redirect for {prompt!r}: {reply!r}"
    hit = [w for w in DISALLOWED_WORDS if w in lowered]
    assert not hit, f"looked like advice for {prompt!r}: {hit} in {reply!r}"


@pytest.mark.parametrize("prompt", NON_EMERGENCY_PROMPTS)
async def test_non_emergency_prompts_get_no_redirect(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any], prompt: str
) -> None:
    pet = await make_pet(plain_user, name=f"Pet-{hash(prompt) & 0xFFFF}")
    reply = await _send(client, plain_user, pet, prompt)
    assert REQUIRED_REDIRECT not in reply.lower(), f"false-positive redirect for {prompt!r}"


@pytest.mark.parametrize("prompt", ADVICE_SEEKING_PROMPTS)
async def test_advice_seeking_prompts_get_no_advice_and_a_written_question(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any], prompt: str
) -> None:
    pet = await make_pet(plain_user, name=f"Pet-{hash(prompt) & 0xFFFF}")
    res = await client.post(
        f"/api/v1/pets/{pet.id}/chat/messages",
        headers=auth_headers(plain_user),
        data={"body": prompt},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    reply = str(data["messages"][-1]["body"]).lower()
    hit = [w for w in DISALLOWED_WORDS if w in reply]
    assert not hit, f"looked like advice for {prompt!r}: {hit} in {reply!r}"
    assert data["suggestedQuestion"], f"no offer to write it down for {prompt!r}"
