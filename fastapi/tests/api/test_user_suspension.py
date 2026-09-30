"""Suspending and restoring an account.

Suspension is a status change and nothing else: the pool user stays exactly as
it was, so restoring is the reverse status change -- nothing to re-create, and
the same pool identity signs straight back in.
"""

from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ACCOUNT_SUSPENDED, Messages
from app.core.enums import UserStatus
from app.core.errors import ConflictError
from app.modules.auth.models import AuthSession
from app.modules.users import service
from app.modules.users.models import User
from tests.api.cognito_fake import FakePool
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole

USERS = "/api/v1/users"
PROFILE = f"{USERS}/profile"
SIGN_IN = "/api/v1/auth/magic-link"


@pytest.fixture
def sent_emails(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    captured: list[tuple[str, str]] = []

    async def fake_send_email(to: str, subject: str, template: str, **_: Any) -> bool:
        captured.append((to, template))
        return True

    monkeypatch.setattr(service, "send_email", fake_send_email)
    return captured


@pytest.fixture
def make_owner(session: AsyncSession, roles: None) -> Callable[..., Any]:
    async def _make(
        email: str = "owner@example.com", status: UserStatus = UserStatus.ACTIVE
    ) -> User:
        return await create_user(session, email=email, role=UserRole.USER, status=status)

    return _make


async def _reviewer(session: AsyncSession) -> User:
    reviewer = await session.scalar(select(User).where(User.is_super_admin.is_(True)))
    assert reviewer is not None
    return reviewer


async def _open_sessions(session: AsyncSession, user_id: Any) -> int:
    rows = await session.execute(
        select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    )
    return len(rows.scalars().all())


async def test_suspending_blocks_the_account_and_emails_the_owner(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_owner: Callable[..., Any],
    sent_emails: list[tuple[str, str]],
) -> None:
    owner = await make_owner()
    owner_headers = auth_headers(owner)
    assert (await client.get(PROFILE, headers=owner_headers)).status_code == 200

    res = await client.patch(f"{USERS}/{owner.id}/suspend", headers=admin_headers)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"] == Messages.USER_SUSPENDED
    assert body["data"]["status"] == int(UserStatus.SUSPENDED)
    assert body["data"]["isActive"] is False
    assert body["data"]["suspendedAt"] is not None
    assert body["data"]["suspendedById"] == str((await _reviewer(session)).id)
    assert sent_emails == [(owner.email, "account-suspended.html")]
    assert await _open_sessions(session, owner.id) == 0

    blocked = await client.get(PROFILE, headers=owner_headers)
    assert blocked.status_code == 403
    assert blocked.json()["errors"][0]["code"] == ACCOUNT_SUSPENDED
    assert blocked.json()["message"] == Messages.ACCOUNT_SUSPENDED
    # Nothing was asked of the pool: the pool user is left exactly as it was.
    assert pool.created == []
    assert pool.revoked == []


async def test_a_suspended_owner_asking_for_a_link_is_told_why(
    client: AsyncClient,
    pool: FakePool,
    make_owner: Callable[..., Any],
) -> None:
    owner = await make_owner(status=UserStatus.SUSPENDED)

    res = await client.post(SIGN_IN, json={"email": owner.email})

    assert res.status_code == 403
    assert res.json()["errors"][0]["code"] == ACCOUNT_SUSPENDED
    assert res.json()["message"] == Messages.ACCOUNT_SUSPENDED


async def test_restoring_lets_the_same_pool_identity_back_in(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_owner: Callable[..., Any],
    sent_emails: list[tuple[str, str]],
) -> None:
    owner = await make_owner()
    await client.patch(f"{USERS}/{owner.id}/suspend", headers=admin_headers)

    res = await client.patch(f"{USERS}/{owner.id}/restore", headers=admin_headers)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"] == Messages.USER_RESTORED
    assert body["data"]["status"] == int(UserStatus.ACTIVE)
    assert body["data"]["activatedAt"] is not None
    assert body["data"]["suspendedAt"] is None
    assert body["data"]["suspendedById"] is None
    assert sent_emails == [
        (owner.email, "account-suspended.html"),
        (owner.email, "account-restored.html"),
    ]
    # The token minted for the untouched pool user works again.
    assert (await client.get(PROFILE, headers=auth_headers(owner))).status_code == 200
    assert pool.created == []


@pytest.mark.parametrize(
    ("action", "status"),
    [
        ("suspend", UserStatus.SUSPENDED),
        ("restore", UserStatus.ACTIVE),
    ],
)
async def test_a_status_change_that_does_not_apply_conflicts(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_owner: Callable[..., Any],
    sent_emails: list[tuple[str, str]],
    action: str,
    status: UserStatus,
) -> None:
    owner = await make_owner(status=status)

    res = await client.patch(f"{USERS}/{owner.id}/{action}", headers=admin_headers)

    assert res.status_code == 409
    assert sent_emails == []


async def test_the_super_admin_cannot_be_suspended(
    session: AsyncSession, admin_headers: dict[str, str], make_owner: Callable[..., Any]
) -> None:
    reviewer = await _reviewer(session)
    other = await make_owner()

    with pytest.raises(ConflictError):
        await service.suspend_user(session, reviewer.id, other.id)


async def test_suspend_warns_when_email_fails(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_owner: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = await make_owner()

    async def failing_send(*_: Any, **__: Any) -> bool:
        return False

    monkeypatch.setattr(service, "send_email", failing_send)

    res = await client.patch(f"{USERS}/{owner.id}/suspend", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["data"]["status"] == int(UserStatus.SUSPENDED)
    assert res.json()["warningType"] == "SOFT"
    assert owner.email in res.json()["warningMessage"]


async def test_the_edit_form_toggle_suspends_and_restores_the_same_way(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_owner: Callable[..., Any],
    sent_emails: list[tuple[str, str]],
) -> None:
    owner = await make_owner()

    off = await client.patch(f"{USERS}/{owner.id}", json={"isActive": False}, headers=admin_headers)
    same = await client.patch(
        f"{USERS}/{owner.id}", json={"isActive": False}, headers=admin_headers
    )
    on = await client.patch(f"{USERS}/{owner.id}", json={"isActive": True}, headers=admin_headers)

    assert off.json()["data"]["status"] == int(UserStatus.SUSPENDED)
    assert same.status_code == 200
    assert on.json()["data"]["status"] == int(UserStatus.ACTIVE)
    # An unchanged status is a no-op, so it sends nothing.
    assert sent_emails == [
        (owner.email, "account-suspended.html"),
        (owner.email, "account-restored.html"),
    ]


async def test_status_changes_are_super_admin_only(
    client: AsyncClient, user_headers: dict[str, str], make_owner: Callable[..., Any]
) -> None:
    owner = await make_owner(email="target@example.com")
    for action in ("suspend", "restore"):
        res = await client.patch(f"{USERS}/{owner.id}/{action}", headers=user_headers)
        assert res.status_code == 403


async def test_the_list_holds_only_active_and_suspended_accounts(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_owner: Callable[..., Any],
) -> None:
    await make_owner(email="active@example.com")
    await make_owner(email="suspended@example.com", status=UserStatus.SUSPENDED)
    # Legacy review states never belong on the Users list.
    await make_owner(email="legacy-pending@example.com", status=UserStatus.PENDING)
    await make_owner(email="legacy-rejected@example.com", status=UserStatus.REJECTED)

    async def emails(query: str = "") -> set[str]:
        res = await client.get(f"{USERS}?pageSize=100{query}", headers=admin_headers)
        assert res.status_code == 200, res.text
        return {row["email"] for row in res.json()["data"]["items"]}

    everyone = await emails()
    assert {"active@example.com", "suspended@example.com"} <= everyone
    assert not {"legacy-pending@example.com", "legacy-rejected@example.com"} & everyone
    assert "suspended@example.com" not in await emails(f"&status={int(UserStatus.ACTIVE)}")
    assert await emails(f"&status={int(UserStatus.SUSPENDED)}") == {"suspended@example.com"}
    assert await emails("&search=suspended") == {"suspended@example.com"}

    res = await client.get(f"{USERS}?status={int(UserStatus.SUSPENDED)}", headers=admin_headers)
    counts = {row["status"]: row["count"] for row in res.json()["data"]["statusCounts"]}
    # why: the facet counts ignore the status filter itself.
    assert counts[int(UserStatus.SUSPENDED)] == 1
    assert counts[int(UserStatus.ACTIVE)] >= 1
    assert set(counts) == {int(UserStatus.ACTIVE), int(UserStatus.SUSPENDED)}


async def test_the_list_refuses_a_legacy_status_filter(
    client: AsyncClient, admin_headers: dict[str, str]
) -> None:
    res = await client.get(f"{USERS}?status={int(UserStatus.PENDING)}", headers=admin_headers)
    assert res.status_code == 400
