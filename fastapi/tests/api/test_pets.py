from collections.abc import Callable
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Species
from app.modules.pets.models import Pet
from app.modules.users.models import User
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole

PETS = "/api/v1/pets"
MILO = {"name": "Milo", "species": int(Species.DOG), "age": "7 yrs", "breed": "Beagle mix"}


@pytest.fixture
def make_pet(session: AsyncSession) -> Callable[..., Any]:
    async def _make(
        owner: User,
        name: str = "Milo",
        species: Species = Species.DOG,
        is_archived: bool = False,
    ) -> Pet:
        pet = Pet(
            owner_id=owner.id,
            name=name,
            species=species,
            is_archived=is_archived,
            created_by_id=owner.id,
            updated_by_id=owner.id,
        )
        session.add(pet)
        await session.flush()
        await session.refresh(pet)
        return pet

    return _make


@pytest.fixture
async def other_owner(session: AsyncSession, roles: None) -> User:
    return await create_user(
        session,
        email="other@example.com",
        role=UserRole.USER,
    )


async def test_create_pet(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(PETS, headers=auth_headers(plain_user), json=MILO)

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["name"] == "Milo"
    assert data["species"] == int(Species.DOG)
    assert data["age"] == "7 yrs"
    assert data["isArchived"] is False


async def test_create_allows_optional_fields_to_be_blank(
    client: AsyncClient, plain_user: User
) -> None:
    res = await client.post(
        PETS,
        headers=auth_headers(plain_user),
        json={"name": "Sana", "species": int(Species.CAT), "age": "", "breed": ""},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["age"] is None
    assert data["breed"] is None


async def test_create_rejects_a_duplicate_name_for_the_same_owner(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    await make_pet(plain_user)

    res = await client.post(PETS, headers=auth_headers(plain_user), json={**MILO, "name": "milo"})

    assert res.status_code == 409
    assert "already exists" in res.json()["errors"][0]["message"]


async def test_two_owners_may_both_have_the_same_pet_name(
    client: AsyncClient,
    plain_user: User,
    other_owner: User,
    make_pet: Callable[..., Any],
) -> None:
    await make_pet(other_owner)

    res = await client.post(PETS, headers=auth_headers(plain_user), json=MILO)

    assert res.status_code == 200


async def test_create_rejects_unknown_fields(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(PETS, headers=auth_headers(plain_user), json={**MILO, "microchip": "x"})
    assert res.status_code == 422


async def test_create_rejects_an_unknown_species(client: AsyncClient, plain_user: User) -> None:
    res = await client.post(PETS, headers=auth_headers(plain_user), json={**MILO, "species": 9})
    assert res.status_code == 422


async def test_list_returns_only_your_own_pets(
    client: AsyncClient,
    plain_user: User,
    other_owner: User,
    make_pet: Callable[..., Any],
) -> None:
    await make_pet(plain_user, name="Mine")
    await make_pet(other_owner, name="Theirs")

    res = await client.get(PETS, headers=auth_headers(plain_user))

    assert res.status_code == 200
    assert [p["name"] for p in res.json()["data"]["items"]] == ["Mine"]


async def test_list_hides_archived_pets_by_default(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    await make_pet(plain_user, name="Active")
    await make_pet(plain_user, name="Retired", is_archived=True)

    res = await client.get(PETS, headers=auth_headers(plain_user))

    assert [p["name"] for p in res.json()["data"]["items"]] == ["Active"]


async def test_list_can_include_archived_pets_last(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    await make_pet(plain_user, name="Retired", is_archived=True)
    await make_pet(plain_user, name="Active")

    res = await client.get(
        PETS, headers=auth_headers(plain_user), params={"includeArchived": "true"}
    )

    # why: archived pets sink to the bottom regardless of creation order.
    assert [p["name"] for p in res.json()["data"]["items"]] == ["Active", "Retired"]


async def test_get_one_of_your_pets(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)

    res = await client.get(f"{PETS}/{pet.id}", headers=auth_headers(plain_user))

    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Milo"


async def test_another_owners_pet_is_not_found(
    client: AsyncClient,
    plain_user: User,
    other_owner: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(other_owner)

    res = await client.get(f"{PETS}/{pet.id}", headers=auth_headers(plain_user))

    assert res.status_code == 404


async def test_unknown_pet_is_not_found(client: AsyncClient, plain_user: User) -> None:
    res = await client.get(f"{PETS}/{uuid4()}", headers=auth_headers(plain_user))
    assert res.status_code == 404


async def test_update_renames_a_pet(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)

    res = await client.patch(
        f"{PETS}/{pet.id}", headers=auth_headers(plain_user), json={"name": "Milo B"}
    )

    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Milo B"


async def test_archive_and_restore_round_trip(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)
    headers = auth_headers(plain_user)

    archived = await client.patch(f"{PETS}/{pet.id}", headers=headers, json={"isArchived": True})
    assert archived.json()["data"]["isArchived"] is True

    restored = await client.patch(f"{PETS}/{pet.id}", headers=headers, json={"isArchived": False})
    assert restored.json()["data"]["isArchived"] is False


async def test_update_rejects_a_name_another_of_your_pets_holds(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    await make_pet(plain_user, name="Milo")
    other = await make_pet(plain_user, name="Sana", species=Species.CAT)

    res = await client.patch(
        f"{PETS}/{other.id}", headers=auth_headers(plain_user), json={"name": "Milo"}
    )

    assert res.status_code == 409


async def test_update_keeping_its_own_name_is_allowed(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)

    res = await client.patch(
        f"{PETS}/{pet.id}",
        headers=auth_headers(plain_user),
        json={"name": "Milo", "age": "8 yrs"},
    )

    assert res.status_code == 200
    assert res.json()["data"]["age"] == "8 yrs"


async def test_cannot_update_another_owners_pet(
    client: AsyncClient,
    plain_user: User,
    other_owner: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(other_owner)

    res = await client.patch(
        f"{PETS}/{pet.id}", headers=auth_headers(plain_user), json={"name": "Hijacked"}
    )

    assert res.status_code == 404


async def test_delete_soft_deletes_and_archives(
    client: AsyncClient,
    session: AsyncSession,
    plain_user: User,
    make_pet: Callable[..., Any],
) -> None:
    pet = await make_pet(plain_user)
    pet_id: UUID = pet.id

    res = await client.delete(f"{PETS}/{pet_id}", headers=auth_headers(plain_user))

    assert res.status_code == 200
    stored = await session.get(Pet, pet_id)
    assert stored is not None
    assert stored.is_deleted is True
    assert stored.is_archived is True


async def test_deleting_frees_the_name_for_reuse(
    client: AsyncClient, plain_user: User, make_pet: Callable[..., Any]
) -> None:
    pet = await make_pet(plain_user)
    await client.delete(f"{PETS}/{pet.id}", headers=auth_headers(plain_user))

    res = await client.post(PETS, headers=auth_headers(plain_user), json=MILO)

    assert res.status_code == 200


async def test_pets_require_authentication(client: AsyncClient, roles: None) -> None:
    assert (await client.get(PETS)).status_code == 401
    assert (await client.post(PETS, json=MILO)).status_code == 401
