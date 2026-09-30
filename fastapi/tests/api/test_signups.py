"""Signup is a request, not an account.

An unknown address files a pending request and nothing else -- no user row, no
pool user. Only an admin's approval creates both; a rejection creates neither,
and stays on record so asking again cannot get past it.
"""

from collections.abc import Callable, Iterator
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.constants import Messages
from app.core.enums import SignupStatus, UserStatus
from app.modules.auth.models import MagicLinkToken
from app.modules.signups import service
from app.modules.signups.constants import SIGNUP_ALREADY_PENDING, SIGNUP_NOT_APPROVED
from app.modules.signups.models import SignupRequest
from app.modules.users.models import User
from app.modules.users.service import soft_delete_user
from tests.api.cognito_fake import FakePool
from tests.api.conftest import create_user
from tests.api.role_compat import UserRole

SIGNUPS = "/api/v1/users/signups"
SIGN_UP = "/api/v1/auth/magic-link"


@pytest.fixture
def sent_emails(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    captured: list[tuple[str, str, str]] = []

    async def fake_send_email(to: str, subject: str, template: str, **_: Any) -> bool:
        captured.append((to, subject, template))
        return True

    monkeypatch.setattr(service, "send_email", fake_send_email)
    return captured


@pytest.fixture
def make_signup(session: AsyncSession, roles: None) -> Callable[..., Any]:
    async def _make(
        email: str = "owner@example.com",
        status: SignupStatus = SignupStatus.PENDING,
    ) -> SignupRequest:
        signup = SignupRequest(email=email, status=status)
        session.add(signup)
        await session.flush()
        await session.refresh(signup)
        return signup

    return _make


async def _users_with(session: AsyncSession, email: str) -> int:
    return await session.scalar(select(func.count()).where(User.email == email)) or 0


async def _requests_for(session: AsyncSession, email: str) -> list[SignupRequest]:
    rows = await session.execute(
        select(SignupRequest)
        .where(SignupRequest.email == email)
        .execution_options(populate_existing=True)
    )
    return list(rows.scalars())


async def _reviewer(session: AsyncSession) -> User:
    # admin_headers signs in as the live Super Admin, whichever row that is.
    reviewer = await session.scalar(select(User).where(User.is_super_admin.is_(True)))
    assert reviewer is not None
    return reviewer


# --- signing up ---------------------------------------------------------------


async def test_signup_files_only_a_pending_request(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    pool.known_users = set()

    res = await client.post(SIGN_UP, json={"email": "new@example.com"})

    assert res.status_code == 200, res.text
    assert res.json()["message"] == Messages.SIGNUP_RECEIVED
    assert res.json()["data"] == {"signupRequested": True}
    [request] = await _requests_for(session, "new@example.com")
    assert request.status is SignupStatus.PENDING
    assert request.user_id is None
    assert await _users_with(session, "new@example.com") == 0
    assert pool.created == []
    assert await session.scalar(select(func.count()).select_from(MagicLinkToken)) == 0


async def test_signing_up_again_while_pending_is_refused(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    first = await client.post(SIGN_UP, json={"email": "new@example.com"})
    second = await client.post(SIGN_UP, json={"email": "new@example.com"})

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["message"] == SIGNUP_ALREADY_PENDING
    assert len(await _requests_for(session, "new@example.com")) == 1
    assert await _users_with(session, "new@example.com") == 0


async def test_a_rejected_address_cannot_sign_up_again(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    make_signup: Callable[..., Any],
) -> None:
    await make_signup(email="refused@example.com", status=SignupStatus.REJECTED)

    res = await client.post(SIGN_UP, json={"email": "refused@example.com"})

    assert res.status_code == 403
    assert res.json()["message"] == SIGNUP_NOT_APPROVED
    [request] = await _requests_for(session, "refused@example.com")
    assert request.status is SignupStatus.REJECTED
    assert await _users_with(session, "refused@example.com") == 0
    assert pool.created == []


async def test_signup_email_case_is_ignored_for_duplicates(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await client.post(SIGN_UP, json={"email": "Mixed@Example.com"})
    res = await client.post(SIGN_UP, json={"email": "mixed@example.com"})

    assert res.status_code == 409
    assert len(await _requests_for(session, "mixed@example.com")) == 1


# --- approving ----------------------------------------------------------------


async def test_approve_creates_the_account_and_the_pool_user(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    pool.known_users = set()
    signup = await make_signup()

    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"] == Messages.SIGNUP_APPROVED
    assert body["data"]["status"] == int(SignupStatus.APPROVED)
    assert body["warningMessage"] == ""
    user = await session.scalar(select(User).where(User.email == signup.email))
    assert user is not None
    assert user.status is UserStatus.ACTIVE
    assert user.is_super_admin is False
    assert body["data"]["userId"] == str(user.id)
    assert pool.created == [signup.email]
    assert [(to, template) for to, _subject, template in sent_emails] == [
        (signup.email, "account-approved.html")
    ]


async def test_an_approved_owner_signs_in_rather_than_signing_up(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    sent_emails: list[tuple[str, str, str]],
    roles: None,
) -> None:
    await client.post(SIGN_UP, json={"email": "new@example.com"})
    [signup] = await _requests_for(session, "new@example.com")
    await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    res = await client.post(SIGN_UP, json={"email": "new@example.com"})

    assert res.status_code == 200
    assert res.json()["message"] == Messages.MAGIC_LINK_SENT
    assert res.json()["data"] == {"signupRequested": False}
    user = await session.scalar(select(User).where(User.email == "new@example.com"))
    assert user is not None
    link = await session.scalar(select(MagicLinkToken).where(MagicLinkToken.user_id == user.id))
    assert link is not None


async def test_approve_warns_when_email_fails(
    client: AsyncClient,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    signup = await make_signup()

    async def failing_send(*_: Any, **__: Any) -> bool:
        return False

    monkeypatch.setattr(service, "send_email", failing_send)

    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert res.status_code == 200
    body = res.json()
    assert body["data"]["status"] == int(SignupStatus.APPROVED)
    assert body["warningType"] == "SOFT"
    assert signup.email in body["warningMessage"]


async def test_approve_stamps_the_reviewing_admin(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    signup = await make_signup()

    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    reviewer = await _reviewer(session)
    assert res.status_code == 200
    assert res.json()["data"]["updatedById"] == str(reviewer.id)
    user = await session.scalar(select(User).where(User.email == signup.email))
    assert user is not None
    assert user.created_by_id == reviewer.id


async def test_approve_refuses_an_address_that_already_has_an_account(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    # An admin invited the address while its request was still waiting.
    await create_user(session, email="owner@example.com", role=UserRole.USER)
    signup = await make_signup(email="owner@example.com")

    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert res.status_code == 409
    assert await _users_with(session, "owner@example.com") == 1
    [request] = await _requests_for(session, "owner@example.com")
    assert request.status is SignupStatus.PENDING
    assert pool.created == []
    assert sent_emails == []


async def test_a_pool_that_cannot_provision_leaves_the_request_pending(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    pool.known_users = set()
    create = pool.admin_create_user

    def refuse(**_: Any) -> dict[str, Any]:
        raise RuntimeError("AdminCreateUser is not granted")

    pool.admin_create_user = refuse  # type: ignore[method-assign]
    signup = await make_signup()

    failed = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert failed.status_code == 503
    assert await _users_with(session, signup.email) == 0
    [request] = await _requests_for(session, signup.email)
    assert request.status is SignupStatus.PENDING
    assert sent_emails == []

    # Once the pool can provision again, the same request approves normally.
    pool.admin_create_user = create  # type: ignore[method-assign]
    retried = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert retried.status_code == 200, retried.text
    assert await _users_with(session, signup.email) == 1
    assert pool.created == [signup.email]


@pytest.fixture
def statements(engine: AsyncEngine) -> Iterator[list[str]]:
    captured: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        captured.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record)
    try:
        yield captured
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record)


@pytest.mark.parametrize("action", ["approve", "reject"])
async def test_a_review_locks_the_request_row(
    client: AsyncClient,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
    statements: list[str],
    action: str,
) -> None:
    # why: two admins reviewing at once must serialise on the request row, so the
    # second sees it is no longer pending instead of creating a second account.
    signup = await make_signup()

    res = await client.patch(f"{SIGNUPS}/{signup.id}/{action}", headers=admin_headers)

    assert res.status_code == 200
    assert any("FROM signup_requests" in sql and "FOR UPDATE" in sql for sql in statements), (
        statements
    )


@pytest.mark.parametrize(
    ("first", "second"),
    [("approve", "approve"), ("approve", "reject"), ("reject", "reject")],
)
async def test_a_final_review_cannot_be_repeated_or_reversed(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
    first: str,
    second: str,
) -> None:
    pool.known_users = set()
    signup = await make_signup()

    done = await client.patch(f"{SIGNUPS}/{signup.id}/{first}", headers=admin_headers)
    again = await client.patch(f"{SIGNUPS}/{signup.id}/{second}", headers=admin_headers)

    assert done.status_code == 200
    assert again.status_code == 409
    assert "already been reviewed" in again.json()["errors"][0]["message"]
    assert await _users_with(session, signup.email) == (1 if first == "approve" else 0)
    assert pool.created == ([signup.email] if first == "approve" else [])


async def test_a_rejected_request_can_still_be_approved(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    pool.known_users = set()
    signup = await make_signup()
    await client.patch(f"{SIGNUPS}/{signup.id}/reject", headers=admin_headers)

    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)

    assert res.status_code == 200, res.text
    assert res.json()["data"]["status"] == int(SignupStatus.APPROVED)
    user = await session.scalar(select(User).where(User.email == signup.email))
    assert user is not None
    assert user.status is UserStatus.ACTIVE
    assert pool.created == [signup.email]
    assert [template for _to, _subject, template in sent_emails] == [
        "signup-rejected.html",
        "account-approved.html",
    ]

    # The owner who was turned away now signs in like anyone approved.
    again = await client.post(SIGN_UP, json={"email": signup.email})
    assert again.status_code == 200
    assert again.json()["message"] == Messages.MAGIC_LINK_SENT


# --- rejecting ----------------------------------------------------------------


async def test_reject_creates_no_account_and_emails_the_owner(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    signup = await make_signup()

    res = await client.patch(f"{SIGNUPS}/{signup.id}/reject", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["message"] == Messages.SIGNUP_REJECTED
    assert res.json()["data"]["status"] == int(SignupStatus.REJECTED)
    assert res.json()["data"]["userId"] is None
    assert await _users_with(session, signup.email) == 0
    assert pool.created == []
    assert [(to, template) for to, _subject, template in sent_emails] == [
        (signup.email, "signup-rejected.html")
    ]
    assert res.json()["warningMessage"] == ""


async def test_reject_warns_when_email_fails(
    client: AsyncClient,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    signup = await make_signup()

    async def failing_send(*_: Any, **__: Any) -> bool:
        return False

    monkeypatch.setattr(service, "send_email", failing_send)

    res = await client.patch(f"{SIGNUPS}/{signup.id}/reject", headers=admin_headers)

    assert res.status_code == 200
    assert res.json()["data"]["status"] == int(SignupStatus.REJECTED)
    assert res.json()["warningType"] == "SOFT"
    assert signup.email in res.json()["warningMessage"]


async def test_a_rejection_holds_when_the_address_signs_up_again(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    roles: None,
) -> None:
    await client.post(SIGN_UP, json={"email": "new@example.com"})
    [signup] = await _requests_for(session, "new@example.com")
    await client.patch(f"{SIGNUPS}/{signup.id}/reject", headers=admin_headers)

    res = await client.post(SIGN_UP, json={"email": "new@example.com"})

    assert res.status_code == 403
    assert res.json()["message"] == SIGNUP_NOT_APPROVED
    [request] = await _requests_for(session, "new@example.com")
    assert request.status is SignupStatus.REJECTED
    assert await _users_with(session, "new@example.com") == 0


async def test_an_address_whose_account_was_deleted_can_ask_again(
    client: AsyncClient,
    session: AsyncSession,
    admin_headers: dict[str, str],
    pool: FakePool,
    make_signup: Callable[..., Any],
    sent_emails: list[tuple[str, str, str]],
) -> None:
    signup = await make_signup()
    await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=admin_headers)
    user = await session.scalar(select(User).where(User.email == signup.email))
    assert user is not None
    await soft_delete_user(session, user.id, (await _reviewer(session)).id)

    res = await client.post(SIGN_UP, json={"email": signup.email})

    assert res.status_code == 200
    assert res.json()["data"] == {"signupRequested": True}
    [request] = await _requests_for(session, signup.email)
    assert request.status is SignupStatus.PENDING
    assert request.user_id is None


# --- listing and access -------------------------------------------------------


async def test_list_signups_returns_requests_not_accounts(
    client: AsyncClient,
    admin_headers: dict[str, str],
    plain_user: User,
    make_signup: Callable[..., Any],
) -> None:
    await make_signup(email="pending@example.com")
    await make_signup(email="approved@example.com", status=SignupStatus.APPROVED)
    await make_signup(email="rejected@example.com", status=SignupStatus.REJECTED)

    res = await client.get(SIGNUPS, headers=admin_headers)

    assert res.status_code == 200
    data = res.json()["data"]
    emails = {row["email"] for row in data["items"]}
    assert emails == {"pending@example.com", "approved@example.com", "rejected@example.com"}
    assert plain_user.email not in emails
    counts = {row["status"]: row["count"] for row in data["statusCounts"]}
    assert counts == {
        int(SignupStatus.PENDING): 1,
        int(SignupStatus.APPROVED): 1,
        int(SignupStatus.REJECTED): 1,
    }


async def test_list_signups_filters_by_status(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_signup: Callable[..., Any],
) -> None:
    await make_signup(email="pending@example.com")
    await make_signup(email="approved@example.com", status=SignupStatus.APPROVED)

    res = await client.get(
        SIGNUPS, headers=admin_headers, params={"status": int(SignupStatus.PENDING)}
    )

    assert res.status_code == 200
    data = res.json()["data"]
    assert [row["email"] for row in data["items"]] == ["pending@example.com"]
    # why: the facet counts deliberately ignore the active status filter.
    assert len(data["statusCounts"]) == 2


async def test_list_signups_searches_by_email(
    client: AsyncClient,
    admin_headers: dict[str, str],
    make_signup: Callable[..., Any],
) -> None:
    await make_signup(email="findme@example.com")
    await make_signup(email="other@example.com")

    res = await client.get(SIGNUPS, headers=admin_headers, params={"search": "findme"})

    assert res.status_code == 200
    assert [row["email"] for row in res.json()["data"]["items"]] == ["findme@example.com"]


async def test_list_signups_forbidden_for_plain_user(
    client: AsyncClient, user_headers: dict[str, str]
) -> None:
    res = await client.get(SIGNUPS, headers=user_headers)
    assert res.status_code == 403


async def test_a_user_id_is_not_a_signup_id(
    client: AsyncClient, admin_headers: dict[str, str], plain_user: User
) -> None:
    res = await client.patch(f"{SIGNUPS}/{plain_user.id}/approve", headers=admin_headers)
    assert res.status_code == 404


async def test_approving_an_unknown_id_is_not_found(
    client: AsyncClient, admin_headers: dict[str, str], roles: None
) -> None:
    res = await client.patch(f"{SIGNUPS}/{uuid4()}/approve", headers=admin_headers)
    assert res.status_code == 404


async def test_approve_forbidden_for_plain_user(
    client: AsyncClient,
    user_headers: dict[str, str],
    make_signup: Callable[..., Any],
) -> None:
    signup = await make_signup(email="target@example.com")
    res = await client.patch(f"{SIGNUPS}/{signup.id}/approve", headers=user_headers)
    assert res.status_code == 403
