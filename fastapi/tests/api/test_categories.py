from collections.abc import Callable
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.categories.models import Category

CATEGORIES = "/api/v1/categories"
PICKER = f"{CATEGORIES}/picker"
SEEDED_NAMES = {"Vet visit", "Your concern", "Attachment note", "Other"}


@pytest.fixture
def make_category(session: AsyncSession) -> Callable[..., Any]:
    async def _make(
        name: str = "Grooming",
        description: str | None = None,
        is_active: bool = True,
        is_deleted: bool = False,
    ) -> Category:
        category = Category(
            name=name,
            description=description,
            is_active=is_active,
            is_deleted=is_deleted,
        )
        session.add(category)
        await session.flush()
        await session.refresh(category)
        return category

    return _make


async def test_migration_seeds_the_four_launch_categories(session: AsyncSession) -> None:
    names = set(
        (await session.execute(select(Category.name).where(Category.is_deleted.is_(False))))
        .scalars()
        .all()
    )
    assert names >= SEEDED_NAMES


async def test_list_returns_seeded_categories_with_facet_counts(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.get(CATEGORIES, headers=admin_headers)

    assert res.status_code == 200
    data = res.json()["data"]
    assert {row["name"] for row in data["items"]} >= SEEDED_NAMES
    assert data["totalRecords"] >= len(SEEDED_NAMES)
    counts = {row["isActive"]: row["count"] for row in data["activeCounts"]}
    assert counts[True] >= len(SEEDED_NAMES)


async def test_list_search_matches_name(client: AsyncClient, admin_headers: dict[str, str]) -> None:
    res = await client.get(CATEGORIES, headers=admin_headers, params={"search": "Vet"})

    assert res.status_code == 200
    assert [row["name"] for row in res.json()["data"]["items"]] == ["Vet visit"]


async def test_list_filters_by_is_active(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    await make_category(name="Retired", is_active=False)

    res = await client.get(CATEGORIES, headers=admin_headers, params={"isActive": "false"})

    assert res.status_code == 200
    data = res.json()["data"]
    assert [row["name"] for row in data["items"]] == ["Retired"]
    # why: the facet counts deliberately ignore the active filter.
    assert len(data["activeCounts"]) == 2


async def test_list_excludes_soft_deleted(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    await make_category(name="Gone", is_deleted=True)

    res = await client.get(CATEGORIES, headers=admin_headers, params={"search": "Gone"})

    assert res.json()["data"]["items"] == []


async def test_list_forbidden_for_plain_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.get(CATEGORIES, headers=user_headers)
    assert res.status_code == 403


async def test_create_category(
    client: AsyncClient, admin_headers: dict[str, str], admin_user: Any
) -> None:
    res = await client.post(
        CATEGORIES,
        headers=admin_headers,
        json={"name": "Medication", "description": "Dosage and schedule notes"},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["name"] == "Medication"
    assert data["isActive"] is True
    assert data["createdById"] == str(admin_user.id)


async def test_create_rejects_a_duplicate_name_case_insensitively(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.post(CATEGORIES, headers=admin_headers, json={"name": "vet VISIT"})

    assert res.status_code == 409
    assert "already exists" in res.json()["errors"][0]["message"]


async def test_create_rejects_unknown_fields(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.post(
        CATEGORIES, headers=admin_headers, json={"name": "Nope", "colour": "red"}
    )
    assert res.status_code == 422


async def test_create_forbidden_for_plain_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.post(CATEGORIES, headers=user_headers, json={"name": "Sneaky"})
    assert res.status_code == 403


async def test_get_category(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()

    res = await client.get(f"{CATEGORIES}/{category.id}", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Grooming"


async def test_get_unknown_category_is_not_found(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.get(f"{CATEGORIES}/{uuid4()}", headers=admin_headers)
    assert res.status_code == 404


async def test_update_renames_and_deactivates(
    client: AsyncClient,
    admin_headers: dict[str, str],
    admin_user: Any,
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()

    res = await client.patch(
        f"{CATEGORIES}/{category.id}",
        headers=admin_headers,
        json={"name": "Grooming & coat", "isActive": False},
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert data["name"] == "Grooming & coat"
    assert data["isActive"] is False
    assert data["updatedById"] == str(admin_user.id)


async def test_update_can_clear_the_description(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category(description="Some text")

    res = await client.patch(
        f"{CATEGORIES}/{category.id}", headers=admin_headers, json={"description": None}
    )

    assert res.status_code == 200
    assert res.json()["data"]["description"] is None


async def test_update_rejects_a_name_taken_by_another_category(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()

    res = await client.patch(
        f"{CATEGORIES}/{category.id}", headers=admin_headers, json={"name": "Other"}
    )

    assert res.status_code == 409


async def test_update_keeping_its_own_name_is_allowed(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()

    res = await client.patch(
        f"{CATEGORIES}/{category.id}",
        headers=admin_headers,
        json={"name": "Grooming", "isActive": False},
    )

    assert res.status_code == 200


async def test_update_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()
    res = await client.patch(
        f"{CATEGORIES}/{category.id}", headers=user_headers, json={"name": "Nope"}
    )
    assert res.status_code == 403


async def test_delete_soft_deletes_and_deactivates(
    client: AsyncClient,
    admin_headers: dict[str, str],
    session: AsyncSession,
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()
    category_id: UUID = category.id

    res = await client.delete(f"{CATEGORIES}/{category_id}", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["data"]["isActive"] is False
    stored = await session.get(Category, category_id)
    assert stored is not None
    assert stored.is_deleted is True


async def test_deleting_frees_the_name_for_reuse(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()
    await client.delete(f"{CATEGORIES}/{category.id}", headers=admin_headers)

    res = await client.post(CATEGORIES, headers=admin_headers, json={"name": "Grooming"})

    assert res.status_code == 200


async def test_delete_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    category = await make_category()
    res = await client.delete(f"{CATEGORIES}/{category.id}", headers=user_headers)
    assert res.status_code == 403


async def test_picker_is_open_to_any_signed_in_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.get(PICKER, headers=user_headers)

    assert res.status_code == 200
    assert {row["name"] for row in res.json()["data"]["items"]} >= SEEDED_NAMES


async def test_picker_omits_inactive_and_deleted_categories(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_category: Callable[..., Any],
) -> None:
    await make_category(name="Retired", is_active=False)
    await make_category(name="Gone", is_deleted=True)

    res = await client.get(PICKER, headers=user_headers)

    names = {row["name"] for row in res.json()["data"]["items"]}
    assert "Retired" not in names
    assert "Gone" not in names


async def test_picker_requires_authentication(client: AsyncClient) -> None:
    res = await client.get(PICKER)
    assert res.status_code == 401
