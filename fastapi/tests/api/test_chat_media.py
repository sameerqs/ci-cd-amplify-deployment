"""Text, photos and PDFs arriving as one turn, and what the window re-sends.

These assert on the prompt the service hands the model, because that is the only
place the multimodal contract is visible: everything downstream is ordinary rows.
"""

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import settings
from app.core.enums import Species
from app.modules.chat.prompts import AssistantTurn
from app.modules.chat.service import MEDIA_RECENT_MESSAGES
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers
from tests.api.test_chat import FakeChatModel, chat_url

pytest_plugins = ["tests.api.test_chat"]

PHOTO = ("paw.jpg", b"\xff\xd8\xff fake jpeg", "image/jpeg")
BILL = ("bill.pdf", b"%PDF-1.4 fake", "application/pdf")
# why: HEIC is what an iPhone camera produces by default and is on the
# attachment allow-list for exactly that reason, but the Responses API's vision
# input does not take image/heic -- so this is a real, reachable gap, not a
# contrived one.
HEIC_PHOTO = ("paw.heic", b"ftypheic fake", "image/heic")


@pytest.fixture(autouse=True)
def local_storage(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "S3_BUCKET", None)
    monkeypatch.setattr(settings, "LOCAL_STORAGE_DIR", str(tmp_path / "attachments"))
    yield
    storage.reset_local_storage()


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


def last_user_blocks(model: FakeChatModel) -> list[Any]:
    """The content of the newest HumanMessage in the newest prompt."""
    prompt = model.structured.prompts[-1]
    human = [m for m in prompt if m.__class__.__name__ == "HumanMessage"]
    content = human[-1].content
    return content if isinstance(content, list) else [content]


async def test_a_photo_and_a_prompt_arrive_as_one_turn(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    model = fake_model([AssistantTurn(reply="I can see a reddish patch.")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "what is this?"},
        files={"files": PHOTO},
    )

    assert res.status_code == 200, res.text
    blocks = last_user_blocks(model)
    assert {"type": "text", "text": "what is this?"} in blocks
    image = [b for b in blocks if isinstance(b, dict) and b.get("type") == "image"]
    assert len(image) == 1
    assert image[0]["mime_type"] == "image/jpeg"
    assert image[0]["base64"]


async def test_a_pdf_is_sent_as_a_file_block_with_its_name(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    model = fake_model([AssistantTurn(reply="Got it.")])

    await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        files={"files": BILL},
    )

    files = [b for b in last_user_blocks(model) if isinstance(b, dict) and b.get("type") == "file"]
    assert len(files) == 1
    # why: the Responses API rejects an input_file with no filename.
    assert files[0]["extras"]["filename"] == "bill.pdf"


async def test_a_type_the_model_cannot_read_is_named_not_sent(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    """A HEIC photo is a legal upload and an illegal prompt input.

    Keeping it and telling the model its name is honest; shipping bytes the API
    will reject would fail the whole turn over a file nobody had to read.
    """
    pet = await make_pet(plain_user)
    model = fake_model([AssistantTurn(reply="Kept that.")])

    await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        files={"files": HEIC_PHOTO},
    )

    blocks = last_user_blocks(model)
    assert {"type": "text", "text": "[attached: paw.heic]"} in blocks
    assert not [b for b in blocks if isinstance(b, dict) and b.get("type") in {"image", "file"}]


async def test_the_file_rides_with_the_message_that_carried_it(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model([AssistantTurn(reply="ok")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "here it is"},
        files={"files": PHOTO},
    )

    data = res.json()["data"]
    owner_turn = next(m for m in data["messages"] if m["body"] == "here it is")
    assert [a["filename"] for a in owner_turn["attachments"]] == ["paw.jpg"]
    # why: it renders in its own bubble now, so listing it at conversation level
    # too drew the same file twice.
    assert data["attachments"] == []


async def test_older_media_falls_out_of_the_window_but_is_still_named(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    """The sliding window: a photo is re-sent for a few turns, then summarised.

    Without this every photo ever attached rode along on every later message, so
    a long conversation got more expensive with each turn for no added context.
    """
    pet = await make_pet(plain_user)
    model = fake_model([AssistantTurn(reply="ok") for _ in range(12)])

    await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "look at this"},
        files={"files": PHOTO},
    )
    for i in range(MEDIA_RECENT_MESSAGES):
        await client.post(
            chat_url(pet.id, "/messages"),
            headers=auth_headers(plain_user),
            data={"body": f"and another thing {i}"},
        )

    prompt = model.structured.prompts[-1]
    rendered = [b for m in prompt for b in (m.content if isinstance(m.content, list) else [])]
    assert not [b for b in rendered if isinstance(b, dict) and b.get("type") == "image"]
    assert {"type": "text", "text": "[attached earlier: paw.jpg]"} in rendered
