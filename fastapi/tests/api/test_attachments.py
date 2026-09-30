from collections.abc import Callable, Iterator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import settings
from app.core.enums import Species
from app.modules.chat.models import Attachment
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole

pytest_plugins = ["tests.api.test_chat"]

PDF = ("Bill_Aug14.pdf", b"%PDF-1.4 fake bytes", "application/pdf")


@pytest.fixture(autouse=True)
def _model(fake_model: Callable[..., Any]) -> None:
    # why: an upload is a message now, so every one of these goes through the
    # assistant turn. Without a stand-in the route answers 503 "not configured".
    fake_model([])


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


def upload_url(pet_id: Any) -> str:
    # why: there is no standalone upload route any more -- a file is part of the
    # turn that carried it, so it goes through the composer's send.
    return f"/api/v1/pets/{pet_id}/chat/messages"


async def test_sending_a_file_keeps_it_and_records_it(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)

    res = await client.post(
        upload_url(pet.id), headers=auth_headers(plain_user), files={"files": PDF}
    )

    assert res.status_code == 200
    card = res.json()["data"]["card"]
    assert card is not None
    entries = [e for g in card["groups"] for e in g["entries"]]
    assert any(e["text"] == "Bill_Aug14.pdf attached" for e in entries)
    assert any(e["provenance"].startswith("you added Bill_Aug14.pdf") for e in entries)

    stored = (
        (await session.execute(select(Attachment).where(Attachment.pet_id == pet.id)))
        .scalars()
        .all()
    )
    assert len(stored) == 1
    assert stored[0].size_bytes == len(PDF[1])


async def test_the_storage_key_is_generated_not_the_uploaded_name(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    await client.post(
        upload_url(pet.id),
        headers=auth_headers(plain_user),
        files={"files": ("../../etc/passwd", b"x", "application/pdf")},
    )

    stored = await session.scalar(select(Attachment).where(Attachment.pet_id == pet.id))
    assert stored is not None
    assert ".." not in stored.storage_key
    assert stored.storage_key.startswith(f"pets/{pet.id}/")
    assert stored.filename == "passwd"


async def test_two_uploads_of_the_same_name_do_not_collide(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    await client.post(upload_url(pet.id), headers=headers, files={"files": PDF})
    await client.post(upload_url(pet.id), headers=headers, files={"files": PDF})

    keys = (
        (await session.execute(select(Attachment.storage_key).where(Attachment.pet_id == pet.id)))
        .scalars()
        .all()
    )
    assert len(keys) == 2
    assert len(set(keys)) == 2


async def test_an_empty_file_is_rejected(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)

    res = await client.post(
        upload_url(pet.id),
        headers=auth_headers(plain_user),
        files={"files": ("empty.pdf", b"", "application/pdf")},
    )

    assert res.status_code == 400


async def test_an_oversized_file_is_rejected(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ATTACHMENT_MAX_BYTES", 1024)
    pet = await make_pet(plain_user)

    res = await client.post(
        upload_url(pet.id),
        headers=auth_headers(plain_user),
        files={"files": ("big.pdf", b"x" * 2048, "application/pdf")},
    )

    assert res.status_code == 400
    assert "limit" in res.json()["errors"][0]["message"]


async def test_cannot_attach_to_another_owners_pet(
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

    res = await client.post(
        upload_url(pet.id), headers=auth_headers(plain_user), files={"files": PDF}
    )

    assert res.status_code == 404


async def test_owner_can_download_their_attachment(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)
    await client.post(upload_url(pet.id), headers=headers, files={"files": PDF})
    stored = await session.scalar(select(Attachment).where(Attachment.pet_id == pet.id))
    assert stored is not None

    res = await client.get(f"/api/v1/files/{stored.storage_key}", headers=headers)

    assert res.status_code == 200
    assert res.content == PDF[1]
    assert "Bill_Aug14.pdf" in res.headers["content-disposition"]


async def test_another_owner_cannot_download_it(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    roles: None,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    await client.post(upload_url(pet.id), headers=auth_headers(plain_user), files={"files": PDF})
    stored = await session.scalar(select(Attachment).where(Attachment.pet_id == pet.id))
    assert stored is not None
    intruder = await create_user(
        session,
        email="intruder@example.com",
        role=UserRole.USER,
    )

    res = await client.get(f"/api/v1/files/{stored.storage_key}", headers=auth_headers(intruder))

    assert res.status_code == 404


async def test_a_guessed_key_is_not_found(client: AsyncClient, plain_user: User) -> None:
    res = await client.get(
        "/api/v1/files/pets/whatever/made-up.pdf", headers=auth_headers(plain_user)
    )
    assert res.status_code == 404


async def test_download_requires_authentication(client: AsyncClient, roles: None) -> None:
    res = await client.get("/api/v1/files/pets/x/y.pdf")
    assert res.status_code == 401


LIST_URL = "/api/v1/attachments"
PHOTO = ("photo_paw.jpg", b"\xff\xd8\xff fake jpeg", "image/jpeg")


async def test_account_lists_every_attachment_across_pets(
    client: AsyncClient,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    milo = await make_pet(plain_user, name="Milo")
    juno = await make_pet(plain_user, name="Juno")
    await client.post(upload_url(milo.id), headers=auth_headers(plain_user), files={"files": PDF})
    await client.post(upload_url(juno.id), headers=auth_headers(plain_user), files={"files": PHOTO})

    res = await client.get(LIST_URL, headers=auth_headers(plain_user))

    assert res.status_code == 200, res.text
    items = res.json()["data"]["items"]
    assert {(i["filename"], i["petName"]) for i in items} == {
        ("Bill_Aug14.pdf", "Milo"),
        ("photo_paw.jpg", "Juno"),
    }
    assert all(i["storageKey"] for i in items)


async def test_account_attachments_are_scoped_to_the_caller(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    mine = await make_pet(plain_user, name="Milo")
    await client.post(upload_url(mine.id), headers=auth_headers(plain_user), files={"files": PDF})
    stranger = await create_user(session, email="stranger@example.com", role=UserRole.USER)

    res = await client.get(LIST_URL, headers=auth_headers(stranger))

    assert res.status_code == 200, res.text
    assert res.json()["data"]["items"] == []


async def test_account_attachments_is_empty_without_uploads(
    client: AsyncClient, plain_user: User
) -> None:
    res = await client.get(LIST_URL, headers=auth_headers(plain_user))
    assert res.status_code == 200
    assert res.json()["data"]["items"] == []
