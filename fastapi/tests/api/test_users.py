from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.routing import APIRoute, iter_route_contexts
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import UserStatus
from app.core.errors import ConflictError
from app.core.pagination import PageQuery
from app.core.utils import utc_now
from app.main import app
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.router import super_admin_only
from app.modules.users.schemas import UserOut
from app.modules.users.service import UserFilters, parse_created_range
from scripts import seed as seed_module
from scripts.seed import seed
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole

USERS = "/api/v1/users"


@pytest.fixture
async def many_users(session: AsyncSession, roles: None) -> list[User]:
    created = []
    for index in range(4):
        created.append(
            await create_user(
                session,
                email=f"admin{index}@example.com",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE if index != 3 else UserStatus.REJECTED,
            )
        )
    created.append(await create_user(session, email="member@example.com", role=UserRole.USER))
    return created


async def test_list_users_defaults_and_facets(
    client: AsyncClient, super_admin_headers: dict[str, str], many_users: list[User]
) -> None:
    response = await client.get(USERS, headers=super_admin_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert {u["email"] for u in data["items"]} == {f"admin{i}@example.com" for i in range(4)}
    assert data["page"] == 1 and data["pageSize"] == 15
    assert data["totalRecords"] == 4 and data["totalPages"] == 1
    assert data["statusCounts"] == [
        {"status": "active", "count": 3},
        {"status": "inactive", "count": 1},
    ]
    assert data["roleCounts"] == [{"role": 1, "count": 4}]
    first = data["items"][0]
    assert set(first) == {
        "id",
        "email",
        "displayName",
        "role",
        "status",
        "onboardingCompletedAt",
        "ageConfirmed",
        "betaDisclaimerAccepted",
        "isActive",
        "createdById",
        "updatedById",
        "createdAt",
        "updatedAt",
    }


async def test_list_users_filters_search_sort_and_paging(
    client: AsyncClient, super_admin_headers: dict[str, str], many_users: list[User]
) -> None:
    async def emails(query: str) -> list[str]:
        result = await client.get(f"{USERS}?{query}", headers=super_admin_headers)
        assert result.status_code == 200, result.text
        return [u["email"] for u in result.json()["data"]["items"]]

    assert await emails("search=admin1") == ["admin1@example.com"]
    assert await emails("search=inactive") == ["admin3@example.com"]
    assert await emails("isActive=false") == ["admin3@example.com"]
    assert await emails("email=admin2") == ["admin2@example.com"]
    assert await emails("role=2") == await emails("role=1")
    assert await emails("sort=email:desc") == [f"admin{i}@example.com" for i in (3, 2, 1, 0)]
    assert await emails("sort=displayName:asc,email:desc") == [
        "admin0@example.com",
        "admin1@example.com",
        "admin2@example.com",
        "admin3@example.com",
    ]
    assert len(await emails("pageSize=2&page=2")) == 2
    now_ms = int(utc_now().timestamp() * 1000)
    assert len(await emails(f"createdAt={now_ms - 86_400_000},{now_ms}")) == 4
    assert await emails(f"createdAt={now_ms + 86_400_000 * 2},{now_ms + 86_400_000 * 3}") == []


async def test_list_users_rejects_bad_query(
    client: AsyncClient, super_admin_headers: dict[str, str], super_admin: User
) -> None:
    assert (
        await client.get(f"{USERS}?sort=email:sideways", headers=super_admin_headers)
    ).status_code == 400
    assert (
        await client.get(f"{USERS}?sort=passwordHash:asc", headers=super_admin_headers)
    ).status_code == 400
    assert (
        await client.get(f"{USERS}?pageSize=101", headers=super_admin_headers)
    ).status_code == 422
    assert (
        await client.get(f"{USERS}?createdAt=abc", headers=super_admin_headers)
    ).status_code == 400


def test_parse_created_range() -> None:
    assert parse_created_range(None) is None
    start, end = parse_created_range("0,0") or (None, None)
    assert start is not None and end is not None
    assert end - start == timedelta(milliseconds=86_400_000 - 1)


def _super_admin_calls(other_id: UUID) -> list[tuple[str, str, dict[str, Any] | None]]:
    return [
        ("POST", "/invite", {"email": "nia@example.com", "role": 1}),
        ("GET", "/super-admin-exists", None),
        ("GET", "", None),
        ("GET", "/{user_id}", None),
        ("PATCH", "/{user_id}", {"isActive": False}),
        ("DELETE", "/{user_id}", None),
    ]


def test_super_admin_call_table_covers_every_gated_route() -> None:
    gated = {
        (method, context.path)
        for context in iter_route_contexts(app.routes)
        if isinstance(context.route, APIRoute)
        and super_admin_only.dependency
        in {dep.call for dep in context.route.dependant.dependencies}
        for method in context.route.methods or ()
    }
    assert gated == {(method, f"{USERS}{path}") for method, path, _ in _super_admin_calls(uuid4())}


async def test_role_gates(
    client: AsyncClient,
    admin_user: User,
    plain_user: User,
    admin_headers: dict[str, str],
    user_headers: dict[str, str],
) -> None:
    for headers, other in ((admin_headers, plain_user), (user_headers, admin_user)):
        for method, path, body in _super_admin_calls(other.id):
            response = await client.request(
                method, f"{USERS}{path.format(user_id=other.id)}", json=body, headers=headers
            )
            assert response.status_code == 403, (method, path, response.text)
            assert response.json()["errors"][0]["code"] == "FORBIDDEN"
    assert (await client.get(f"{USERS}/picker", headers=admin_headers)).status_code == 200
    assert (await client.get(f"{USERS}/picker", headers=user_headers)).status_code == 403


async def test_get_user_and_self_targeting(
    client: AsyncClient, super_admin: User, super_admin_headers: dict[str, str], admin_user: User
) -> None:
    found = await client.get(f"{USERS}/{admin_user.id}", headers=super_admin_headers)
    assert found.status_code == 200
    assert found.json()["data"]["displayName"] == admin_user.email
    assert (
        await client.get(f"{USERS}/{super_admin.id}", headers=super_admin_headers)
    ).status_code == 404
    assert (await client.get(f"{USERS}/{uuid4()}", headers=super_admin_headers)).status_code == 404
    assert (await client.get(f"{USERS}/not-a-uuid", headers=super_admin_headers)).status_code == 422


async def test_invite_flow(
    client: AsyncClient,
    super_admin: User,
    super_admin_headers: dict[str, str],
    session: AsyncSession,
) -> None:
    payload = {"email": "Nia@Example.com", "role": 1}
    response = await client.post(f"{USERS}/invite", json=payload, headers=super_admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["message"] == "User invited successfully"
    assert body["warningType"] == "SOFT"
    assert "nia@example.com" in body["warningMessage"]
    created = body["data"]
    assert created["email"] == "nia@example.com"
    # why: no password is minted for an invite -- Cognito owns credentials, and
    # the invitee signs in through the same link everyone else uses.
    assert created["displayName"] == "nia@example.com"
    assert created["createdById"] == str(super_admin.id)
    duplicate = await client.post(f"{USERS}/invite", json=payload, headers=super_admin_headers)
    assert duplicate.status_code == 409
    super_admin_invite = await client.post(
        f"{USERS}/invite",
        json={**payload, "email": "x@example.com", "role": 0},
        headers=super_admin_headers,
    )
    assert super_admin_invite.status_code == 422


async def test_invite_sends_email_when_configured(
    client: AsyncClient, super_admin_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_send(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("app.modules.users.service.send_email", fake_send)
    response = await client.post(
        f"{USERS}/invite",
        json={"email": "mia@example.com", "role": 1},
        headers=super_admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["warningType"] is None


async def test_update_user_and_super_admin_singleton(
    client: AsyncClient,
    super_admin_headers: dict[str, str],
    admin_user: User,
    session: AsyncSession,
) -> None:
    old_headers = auth_headers(admin_user)
    response = await client.patch(
        f"{USERS}/{admin_user.id}",
        json={"isActive": False},
        headers=super_admin_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["isActive"] is False
    assert (await client.get("/api/v1/users/profile", headers=old_headers)).status_code == 401
    promote = await client.patch(
        f"{USERS}/{admin_user.id}", json={"role": 0}, headers=super_admin_headers
    )
    assert promote.status_code == 409
    assert "Super Admin already exists" in promote.json()["message"]
    extra = await client.patch(
        f"{USERS}/{admin_user.id}", json={"email": "x@y.z"}, headers=super_admin_headers
    )
    assert extra.status_code == 422


async def test_soft_delete_anonymises_email(
    client: AsyncClient,
    super_admin_headers: dict[str, str],
    admin_user: User,
    session: AsyncSession,
) -> None:
    original = admin_user.email
    response = await client.delete(f"{USERS}/{admin_user.id}", headers=super_admin_headers)
    assert response.status_code == 200
    deleted = response.json()["data"]
    assert deleted["email"].startswith(original) and deleted["email"] != original
    assert (
        await client.get(f"{USERS}/{admin_user.id}", headers=super_admin_headers)
    ).status_code == 404
    reinvite = await client.post(
        f"{USERS}/invite",
        json={"email": original, "role": 1},
        headers=super_admin_headers,
    )
    assert reinvite.status_code == 200


async def test_profile_is_the_signed_in_row_and_is_read_only(
    client: AsyncClient, admin_user: User
) -> None:
    headers = auth_headers(admin_user)

    profile = await client.get(f"{USERS}/profile", headers=headers)

    assert profile.status_code == 200
    assert profile.json()["data"]["email"] == admin_user.email
    # why: this product asks for an email, an age confirmation and a disclaimer.
    # None of those is something a person edits afterwards, so there is no PATCH.
    assert (await client.patch(f"{USERS}/profile", json={}, headers=headers)).status_code != 200


async def test_picker_and_super_admin_exists(
    client: AsyncClient,
    super_admin: User,
    super_admin_headers: dict[str, str],
    many_users: list[User],
) -> None:
    picker = await client.get(f"{USERS}/picker", headers=super_admin_headers)
    names = [option["label"] for option in picker.json()["data"]["items"]]
    # The label is the email now: it is the only name this product holds.
    assert names == [
        "admin0@example.com",
        "admin1@example.com",
        "admin2@example.com",
        "root@example.com",
    ]
    exists = await client.get(f"{USERS}/super-admin-exists", headers=super_admin_headers)
    assert exists.json()["data"] == {"exists": True}


async def test_service_outputs_survive_session_expiry(
    session: AsyncSession, admin_user: User
) -> None:
    user_id, email = admin_user.id, admin_user.email
    user_out = await service.read_user(session, user_id)
    session.expire_all()
    assert UserOut.model_validate(user_out).display_name == "admin@example.com"
    assert user_out.model_dump()["displayName"] == "admin@example.com"
    profile = await service.read_profile(session, user_id)
    session.expire_all()
    assert profile.model_dump()["email"] == email
    page = await service.list_users(session, PageQuery(), UserFilters(), uuid4())
    session.expire_all()
    assert [UserOut.model_validate(item).email for item in page.items] == [email]


async def test_seed_creates_updates_and_promotes(session: AsyncSession) -> None:
    assert await seed(session, "boss@example.com") == "created"
    assert await seed(session, "boss@example.com") == "updated"
    boss = await session.scalar(select(User).where(User.email == "boss@example.com"))
    assert boss is not None and boss.is_super_admin
    assert await seed(session, "new-boss@example.com") == "updated"
    await session.refresh(boss)
    assert boss.email == "new-boss@example.com"
    await create_user(session, email="taken@example.com", role=UserRole.ADMIN)
    with pytest.raises(ConflictError):
        await seed(session, "taken@example.com")
    boss.is_deleted = True
    await session.flush()
    assert await seed(session, "taken@example.com") == "promoted"


async def test_seed_cli(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(settings, "SEED_ADMIN_EMAIL", None)
    assert await seed_module.main() == 1
    assert "required" in capsys.readouterr().err

    @asynccontextmanager
    async def factory() -> Any:
        yield session

    class FakeEngine:
        async def dispose(self) -> None:
            return None

    monkeypatch.setattr(seed_module, "async_session_factory", factory)
    monkeypatch.setattr(seed_module, "engine", FakeEngine())
    monkeypatch.setattr(settings, "SEED_ADMIN_EMAIL", "cli@example.com")
    assert await seed_module.main() == 0
    assert "created" in capsys.readouterr().out
    await create_user(session, email="other@example.com", role=UserRole.ADMIN)
    monkeypatch.setattr(settings, "SEED_ADMIN_EMAIL", "other@example.com")
    assert await seed_module.main() == 1
    assert "Seed aborted" in capsys.readouterr().err
