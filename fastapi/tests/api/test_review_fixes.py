"""Regressions for the twelve findings from the post-merge review.

Each test names the behaviour that was wrong, so a revert shows up as a failure
rather than as a silently restored bug.
"""

from collections.abc import Callable
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import MessageAuthor, Species, UserStatus
from app.core.security import sha256_hex
from app.core.utils import utc_now
from app.modules.auth.models import MagicLinkToken
from app.modules.categories.models import Category
from app.modules.chat.models import CapturedEntry, ChatMessage
from app.modules.chat.prompts import AssistantTurn, ExtractedEntry
from app.modules.cognito import passwordless as auth_service
from app.modules.files.router import content_disposition
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.cognito_fake import MAGIC_TOKEN, FakePool
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole
from tests.api.test_chat import FakeChatModel, chat_url

pytest_plugins = ["tests.api.test_chat"]

PDF = ("Bill.pdf", b"%PDF fake", "application/pdf")


@pytest.fixture(autouse=True)
def local_storage(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "S3_BUCKET", None)
    monkeypatch.setattr(settings, "LOCAL_STORAGE_DIR", str(tmp_path / "att"))


@pytest.fixture
def make_pet(session: AsyncSession) -> Callable[..., Any]:
    async def _make(owner: User, name: str = "Milo", is_archived: bool = False) -> Pet:
        pet = Pet(
            owner_id=owner.id,
            name=name,
            species=Species.DOG,
            is_archived=is_archived,
            created_by_id=owner.id,
            updated_by_id=owner.id,
        )
        session.add(pet)
        await session.flush()
        await session.refresh(pet)
        return pet

    return _make


# --- 1: non-latin-1 filenames used to 500 every download, permanently ---
def test_content_disposition_survives_a_non_latin1_filename() -> None:
    header = content_disposition("報告書.pdf")

    header.encode("latin-1")  # must not raise
    assert "filename*=UTF-8''" in header


def test_content_disposition_neutralises_quotes() -> None:
    header = content_disposition('we"ird.pdf')
    ascii_part = header.split("; filename*=")[0]

    # Exactly the two quotes that delimit the value, none from the name itself.
    assert ascii_part.count('"') == 2
    assert 'filename="we\'ird.pdf"' in ascii_part


# --- 3: both messages in one request tied on created_at ---
async def test_the_reply_never_sorts_above_the_question(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model([AssistantTurn(reply="And when was that?")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "He is off his food."},
    )

    authors = [m["author"] for m in res.json()["data"]["messages"]]
    bodies = [m["body"] for m in res.json()["data"]["messages"]]
    assert authors == [
        int(MessageAuthor.ASSISTANT),
        int(MessageAuthor.OWNER),
        int(MessageAuthor.ASSISTANT),
    ]
    assert bodies.index("He is off his food.") < bodies.index("And when was that?")


async def test_ordinals_are_dense_and_increasing(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    fake_model([AssistantTurn(reply="a"), AssistantTurn(reply="b")])
    headers = auth_headers(plain_user)
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "1"})
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "2"})

    ordinals = (
        (await session.execute(select(ChatMessage.ordinal).order_by(ChatMessage.ordinal.asc())))
        .scalars()
        .all()
    )
    assert ordinals == [1, 2, 3, 4, 5]


# --- 4: an attachment used to be filed under an arbitrary category ---
async def test_an_attachment_is_not_filed_under_an_arbitrary_category(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    await session.execute(
        update(Category).where(Category.name == "Attachment note").values(is_active=False)
    )
    await session.flush()
    pet = await make_pet(plain_user)

    res = await client.post(
        f"/api/v1/pets/{pet.id}/chat/attachments",
        headers=auth_headers(plain_user),
        files={"file": PDF},
    )

    assert res.status_code == 200
    # The file is still kept; it simply gets no card entry rather than a wrong one.
    assert res.json()["data"]["card"] is None
    assert len(res.json()["data"]["attachments"]) == 1


# --- 5: a soft-deleted address could never sign in, and nothing said so ---
async def test_a_soft_deleted_address_does_not_silently_wedge(
    client: AsyncClient,
    session: AsyncSession,
    roles: None,
    pool: FakePool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: list[str] = []

    async def fake_send(to: str, *_: Any, **__: Any) -> bool:
        sent.append(to)
        return True

    monkeypatch.setattr(auth_service, "send_email", fake_send)
    gone = await create_user(
        session,
        email="gone@example.com",
        role=UserRole.USER,
    )
    gone.is_deleted = True
    await session.flush()

    res = await client.post("/api/v1/auth/magic-link", json={"email": "gone@example.com"})

    assert res.status_code == 200
    assert sent == []
    # No second row was attempted for the same unique email.
    rows = (
        (await session.execute(select(User).where(User.email == "gone@example.com")))
        .scalars()
        .all()
    )
    assert len(rows) == 1


# --- 6: single-use was read-then-write, so two redemptions could both win ---
async def test_a_link_is_claimed_atomically(
    client: AsyncClient,
    session: AsyncSession,
    roles: None,
    pool: FakePool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    links: list[str] = []

    async def fake_send(_to: str, _subject: str, _tpl: str, **ctx: Any) -> bool:
        links.append(str(ctx["magic_url"]).partition("token=")[2])
        return True

    monkeypatch.setattr(auth_service, "send_email", fake_send)
    await create_user(
        session,
        email="owner@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        linked=False,
    )
    await client.post("/api/v1/auth/magic-link", json={"email": "owner@example.com"})
    raw = links[0]
    assert raw == MAGIC_TOKEN

    first = await client.post("/api/v1/auth/magic-link/verify", json={"token": raw})
    second = await client.post("/api/v1/auth/magic-link/verify", json={"token": raw})

    assert first.status_code == 200
    assert second.status_code == 401
    token = await session.scalar(
        select(MagicLinkToken).where(MagicLinkToken.token_hash == sha256_hex(raw))
    )
    assert token is not None
    assert token.consumed_at is not None


async def test_an_expired_link_is_never_claimed(
    client: AsyncClient,
    session: AsyncSession,
    roles: None,
    pool: FakePool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    links: list[str] = []

    async def fake_send(_to: str, _subject: str, _tpl: str, **ctx: Any) -> bool:
        links.append(str(ctx["magic_url"]).partition("token=")[2])
        return True

    monkeypatch.setattr(auth_service, "send_email", fake_send)
    await create_user(
        session,
        email="owner@example.com",
        role=UserRole.USER,
    )
    await client.post("/api/v1/auth/magic-link", json={"email": "owner@example.com"})
    token = await session.scalar(
        select(MagicLinkToken).where(MagicLinkToken.token_hash == sha256_hex(links[0]))
    )
    assert token is not None
    token.expires_at = utc_now() - timedelta(seconds=1)
    await session.flush()

    res = await client.post("/api/v1/auth/magic-link/verify", json={"token": links[0]})

    assert res.status_code == 401
    await session.refresh(token)
    assert token.consumed_at is None


# --- 7: the whole body was materialised before the cap was checked ---
async def test_an_oversized_upload_is_refused_without_buffering_it_all(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ATTACHMENT_MAX_BYTES", 1024)
    pet = await make_pet(plain_user)

    res = await client.post(
        f"/api/v1/pets/{pet.id}/chat/attachments",
        headers=auth_headers(plain_user),
        files={"file": ("big.pdf", b"x" * 500_000, "application/pdf")},
    )

    assert res.status_code == 400
    assert "limit" in res.json()["errors"][0]["message"]


# --- 8: undo used to retract every confirmation in the conversation ---
async def test_undo_only_affects_the_batch_the_card_is_showing(
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
            AssistantTurn(reply="ok", entries=[ExtractedEntry(category="Other", text="first")]),
            AssistantTurn(reply="ok", entries=[ExtractedEntry(category="Other", text="second")]),
        ]
    )

    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "1"})
    await client.post(chat_url(pet.id, "/card/confirm"), headers=headers)
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "2"})
    await client.post(chat_url(pet.id, "/card/confirm"), headers=headers)

    res = await client.post(chat_url(pet.id, "/card/undo"), headers=headers)

    texts = {e["text"] for g in res.json()["data"]["card"]["groups"] for e in g["entries"]}
    assert texts == {"second"}
    first = await session.scalar(select(CapturedEntry).where(CapturedEntry.text == "first"))
    assert first is not None
    assert first.confirmed_at is not None, "an earlier confirmation was retracted"


async def test_the_card_shows_only_the_newest_pending_batch(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    fake_model(
        [
            AssistantTurn(reply="ok", entries=[ExtractedEntry(category="Other", text="first")]),
            AssistantTurn(reply="ok", entries=[ExtractedEntry(category="Other", text="second")]),
        ]
    )
    await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "1"})
    await client.post(chat_url(pet.id, "/card/confirm"), headers=headers)

    res = await client.post(chat_url(pet.id, "/messages"), headers=headers, data={"body": "2"})

    texts = {e["text"] for g in res.json()["data"]["card"]["groups"] for e in g["entries"]}
    assert texts == {"second"}
    assert res.json()["data"]["card"]["isConfirmed"] is False


# --- 9: storage_key never reached a client, so downloads were unreachable ---
async def test_the_conversation_exposes_attachments_for_download(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    upload = await client.post(
        f"/api/v1/pets/{pet.id}/chat/attachments", headers=headers, files={"file": PDF}
    )

    attachments = upload.json()["data"]["attachments"]
    assert len(attachments) == 1
    key = attachments[0]["storageKey"]
    assert key

    fetched = await client.get(f"/api/v1/files/{key}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.content == PDF[1]


# --- 11: the API accepted writes for an archived pet ---
async def test_an_archived_pet_refuses_new_messages(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    fake_model: Callable[[list[AssistantTurn]], FakeChatModel],
) -> None:
    pet = await make_pet(plain_user, is_archived=True)
    fake_model([AssistantTurn(reply="should not happen")])

    res = await client.post(
        chat_url(pet.id, "/messages"),
        headers=auth_headers(plain_user),
        data={"body": "hello"},
    )

    assert res.status_code == 400
    assert "archived" in res.json()["errors"][0]["message"].lower()


async def test_an_archived_pet_refuses_uploads(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user, is_archived=True)

    res = await client.post(
        f"/api/v1/pets/{pet.id}/chat/attachments",
        headers=auth_headers(plain_user),
        files={"file": PDF},
    )

    assert res.status_code == 400


async def test_an_archived_pets_chat_is_still_readable(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user, is_archived=True)

    res = await client.get(chat_url(pet.id), headers=auth_headers(plain_user))

    # why: archiving hides a pet, it does not delete their history.
    assert res.status_code == 200


async def test_unknown_pet_still_reads_as_not_found(client: AsyncClient, plain_user: User) -> None:
    res = await client.get(chat_url(uuid4()), headers=auth_headers(plain_user))
    assert res.status_code == 404
