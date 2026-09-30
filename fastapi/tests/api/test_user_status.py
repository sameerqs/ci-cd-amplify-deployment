from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ACCOUNT_NOT_APPROVED, ACCOUNT_PENDING_APPROVAL, Messages
from app.core.enums import UserStatus
from app.modules.users.models import User
from tests.api.conftest import auth_headers, create_user
from tests.api.role_compat import UserRole

LOGIN = "/api/v1/auth/login"
USERS = "/api/v1/users"


async def _stored_status(session: AsyncSession, user_id: UUID) -> UserStatus:
    stored = await session.scalar(select(User.status).where(User.id == user_id))
    assert isinstance(stored, UserStatus)
    return stored


async def test_new_user_defaults_to_pending_onboarding(session: AsyncSession, roles: None) -> None:
    user = User(email="fresh@example.com")
    session.add(user)
    await session.flush()
    await session.refresh(user)
    assert user.status is UserStatus.PENDING
    assert user.onboarding_completed_at is None
    assert user.age_confirmed is False
    assert user.beta_disclaimer_accepted is False


async def test_invite_display_name_falls_back_to_the_email(
    client: AsyncClient, super_admin_headers: dict[str, str], session: AsyncSession
) -> None:
    # why: full_name is gone; displayName is now composed on read from the name
    # parts, falling back to the email when there are none.
    payload = {
        "email": "ada@example.com",
        "role": 1,
    }
    response = await client.post(f"{USERS}/invite", json=payload, headers=super_admin_headers)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["displayName"] == response.json()["data"]["email"]


@pytest.mark.parametrize(
    ("status", "code", "message"),
    [
        (UserStatus.PENDING, ACCOUNT_PENDING_APPROVAL, Messages.ACCOUNT_PENDING_APPROVAL),
        (UserStatus.REJECTED, ACCOUNT_NOT_APPROVED, Messages.ACCOUNT_NOT_APPROVED),
    ],
)
async def test_an_unapproved_user_is_told_why_they_cannot_use_the_app(
    client: AsyncClient,
    session: AsyncSession,
    roles: None,
    status: UserStatus,
    code: str,
    message: str,
) -> None:
    blocked = await create_user(
        session, email="blocked@example.com", role=UserRole.USER, status=status
    )
    # why: Cognito may happily authenticate this address; approval is ours. A 403
    # with its own code, not a 401 the client would read as an expired session.
    profile = await client.get(f"{USERS}/profile", headers=auth_headers(blocked))
    assert profile.status_code == 403
    assert profile.json()["message"] == message
    assert profile.json()["errors"][0]["code"] == code


async def test_list_reports_a_suspended_account_as_inactive(
    client: AsyncClient, admin_headers: dict[str, str], session: AsyncSession, roles: None
) -> None:
    suspended = await create_user(
        session,
        email="suspended@example.com",
        role=UserRole.USER,
        status=UserStatus.SUSPENDED,
    )
    response = await client.get(
        f"{USERS}?status={int(UserStatus.SUSPENDED)}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert [item["email"] for item in data["items"]] == [suspended.email]
    assert data["items"][0]["status"] == int(UserStatus.SUSPENDED)
    assert data["items"][0]["isActive"] is False
