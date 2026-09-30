"""The one way into this application: an email address and a link.

Cognito mints and checks the link; this application decides who is allowed to
receive one. These tests pin both halves: an active account gets a link, and an
account that is not approved is told why instead. Addresses with no account go
through the signup-request flow -- see test_signups.py.
"""

from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ACCOUNT_NOT_APPROVED, ACCOUNT_PENDING_APPROVAL, Messages
from app.core.enums import SignupStatus, UserStatus
from app.core.security import sha256_hex
from app.core.utils import utc_now
from app.modules.auth.models import MagicLinkToken
from app.modules.cognito import passwordless
from app.modules.signups.models import SignupRequest
from app.modules.users.models import User
from tests.api.cognito_fake import MAGIC_TOKEN, POOL_SUB, FakePool
from tests.api.conftest import create_user
from tests.api.role_compat import UserRole

REQUEST = "/api/v1/auth/magic-link"
VERIFY = "/api/v1/auth/magic-link/verify"


async def _owner(
    session: AsyncSession,
    email: str = "owner@example.com",
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    # An owner who has never signed in yet: the pool has not vouched for this
    # address, so verifying the link is what binds `sub` to the row.
    return await create_user(session, email=email, role=UserRole.USER, status=status, linked=False)


async def _stored_link(session: AsyncSession, user_id: Any) -> MagicLinkToken | None:
    result = await session.execute(select(MagicLinkToken).where(MagicLinkToken.user_id == user_id))
    return result.scalars().first()


async def test_an_active_account_gets_a_link_and_the_pool_session_is_kept(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200, res.text
    stored = await _stored_link(session, user.id)
    assert stored is not None
    # The raw token is never persisted, only its hash, and Cognito's opaque
    # Session string rides along for the second call.
    assert stored.cognito_session == "sess-abc"
    assert stored.token_hash == sha256_hex(MAGIC_TOKEN)


async def test_an_unknown_address_lands_in_the_approval_queue(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    res = await client.post(REQUEST, json={"email": "new@example.com"})

    assert res.status_code == 200
    queued = await session.scalar(
        select(SignupRequest).where(SignupRequest.email == "new@example.com")
    )
    assert queued is not None
    assert queued.status is SignupStatus.PENDING
    # A request is not an account: no user row until an admin approves it.
    assert await session.scalar(select(User).where(User.email == "new@example.com")) is None


@pytest.mark.parametrize(
    ("status", "code", "message"),
    [
        (UserStatus.PENDING, ACCOUNT_PENDING_APPROVAL, Messages.ACCOUNT_PENDING_APPROVAL),
        (UserStatus.REJECTED, ACCOUNT_NOT_APPROVED, Messages.ACCOUNT_NOT_APPROVED),
    ],
)
async def test_an_unapproved_account_is_told_why_and_gets_no_link(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    status: UserStatus,
    code: str,
    message: str,
) -> None:
    # Cognito authenticates; this application still decides who is allowed in.
    user = await _owner(session, email="waiting@example.com", status=status)

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 403
    assert res.json()["message"] == message
    assert res.json()["errors"][0]["code"] == code
    assert await _stored_link(session, user.id) is None
    assert pool.created == []


async def test_a_missing_lambda_trigger_is_loud_in_the_log_and_silent_to_the_caller(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # why: a pool without the CreateAuthChallenge trigger returns no magic_token.
    # That is a deployment fault -- loud in the log, invisible to the caller.
    pool.magic_token = None
    user = await _owner(session)

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200
    assert await _stored_link(session, user.id) is None
    assert "CreateAuthChallenge" in caplog.text


async def test_a_deleted_address_is_ignored_rather_than_resurrected(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session, email="gone@example.com")
    user.is_deleted = True
    await session.flush()

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200
    assert await _stored_link(session, user.id) is None


async def test_a_malformed_email_is_rejected(
    client: AsyncClient, pool: FakePool, roles: None
) -> None:
    res = await client.post(REQUEST, json={"email": "not-an-email"})

    assert res.status_code == 422


async def test_verifying_a_link_opens_a_session_and_binds_the_pool_identity(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["accessToken"] == pool.access_token
    assert data["expiresIn"] == 900
    # The session handle is a cookie, never something a script can read.
    assert "refreshToken" not in data
    await session.refresh(user)
    assert user.cognito_sub == POOL_SUB


async def test_a_link_works_only_once(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})

    first = await client.post(VERIFY, json={"token": MAGIC_TOKEN})
    second = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert first.status_code == 200
    assert second.status_code == 401


async def test_an_expired_link_is_rejected(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})
    await session.execute(
        update(MagicLinkToken)
        .where(MagicLinkToken.user_id == user.id)
        .values(expires_at=utc_now() - timedelta(minutes=1))
    )

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 401
    assert pool.answered == []


async def test_a_link_stops_working_once_the_account_leaves_active(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})
    user.status = UserStatus.REJECTED
    await session.flush()

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 403
    assert res.json()["errors"][0]["code"] == ACCOUNT_NOT_APPROVED
    assert pool.answered == []


async def test_an_unknown_token_is_rejected(
    client: AsyncClient, pool: FakePool, roles: None
) -> None:
    res = await client.post(VERIFY, json={"token": "x" * 40})

    assert res.status_code == 401


async def test_a_challenge_the_pool_will_not_authenticate_is_rejected(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    # Cognito answered, but with another challenge rather than tokens.
    pool.authenticates = False
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 401


async def test_verify_reports_whether_onboarding_is_still_owed(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.json()["data"]["onboardingCompletedAt"] is None


async def test_dev_logs_the_link_when_smtp_is_absent(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(settings, "ENV", "development")

    async def no_smtp(*args: Any, **kwargs: Any) -> bool:
        return False

    monkeypatch.setattr(passwordless, "send_email", no_smtp)
    user = await _owner(session)

    await client.post(REQUEST, json={"email": user.email})

    assert MAGIC_TOKEN in caplog.text


async def test_the_link_is_never_logged_outside_development(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # why: a sign-in link in a production log is a credential in a log.
    monkeypatch.setattr(settings, "ENV", "production")

    async def no_smtp(*args: Any, **kwargs: Any) -> bool:
        return False

    monkeypatch.setattr(passwordless, "send_email", no_smtp)
    user = await _owner(session)

    await client.post(REQUEST, json={"email": user.email})

    assert MAGIC_TOKEN not in caplog.text


async def test_an_unreachable_pool_still_answers_like_a_sent_link(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # why: an outage must look like any other send -- a 503 here would be loud
    # to the caller while telling them nothing they can act on.
    def explode(**_: Any) -> dict[str, Any]:
        raise RuntimeError("pool is down")

    pool.start_passwordless = explode  # type: ignore[method-assign]
    user = await _owner(session)

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200
    assert res.json()["message"] == Messages.MAGIC_LINK_SENT
    assert res.json()["data"] == {"signupRequested": False}
    assert "no link sent" in caplog.text


async def test_an_address_the_pool_does_not_hold_is_provisioned_before_the_link_goes_out(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    # why: InitiateAuth answers for an address the pool has never seen with a
    # decoy challenge that carries a perfectly real-looking token, so the link
    # is only discovered to be dead once the user has clicked it. The pool user
    # has to exist before a link is minted, not after.
    pool.known_users = set()
    user = await _owner(session, email="firsttime@example.com")

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200
    assert pool.created == ["firsttime@example.com"]
    assert await _stored_link(session, user.id) is not None


async def test_no_link_is_sent_when_the_pool_user_cannot_be_provisioned(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    pool.known_users = set()

    def refuse(**_: Any) -> dict[str, Any]:
        raise RuntimeError("AdminCreateUser is not granted")

    pool.admin_create_user = refuse  # type: ignore[method-assign]
    user = await _owner(session, email="unprovisionable@example.com")

    res = await client.post(REQUEST, json={"email": user.email})

    # Same 200 as every other address -- and no link the user could act on.
    assert res.status_code == 200
    assert await _stored_link(session, user.id) is None
    assert "no link sent" in caplog.text


async def test_a_pool_rejection_reads_as_a_dead_link_rather_than_a_cognito_string(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    # why: the pool's own wording ("Unable to complete the Cognito request")
    # reached the sign-in screen and told the visitor nothing they could do.
    user = await _owner(session)
    await client.post(REQUEST, json={"email": user.email})

    def refuse(**_: Any) -> dict[str, Any]:
        raise RuntimeError("NotAuthorizedException")

    pool.answer_passwordless = refuse  # type: ignore[method-assign]
    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 401
    assert "Cognito" not in res.json()["message"]
    assert "request a new one" in res.json()["message"].lower()


async def test_a_row_bound_to_a_pool_identity_that_still_exists_is_never_rebound(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _owner(session)
    user.cognito_sub = "99999999-9999-9999-9999-999999999999"
    await session.flush()
    await client.post(REQUEST, json={"email": user.email})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 401
    await session.refresh(user)
    assert user.cognito_sub == "99999999-9999-9999-9999-999999999999"


async def test_a_row_bound_to_a_pool_identity_that_is_gone_adopts_the_new_one(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    # why: rebuilding the pool otherwise locked every existing account out for
    # good, with nothing but a misleading "this link has expired" to say why.
    stale = "99999999-9999-9999-9999-999999999999"
    user = await _owner(session)
    user.cognito_sub = stale
    await session.flush()
    pool.known_users = {user.email, POOL_SUB}
    await client.post(REQUEST, json={"email": user.email})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    assert res.status_code == 200, res.text
    await session.refresh(user)
    assert user.cognito_sub == POOL_SUB


async def test_a_pool_lookup_it_cannot_answer_does_not_take_sign_in_down(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # why: the existence check needs AdminGetUser. A deployment without that
    # permission must keep working for everyone the pool already holds -- the
    # check is an improvement on not checking, not a new way to be locked out.
    def refuse(**_: Any) -> bool:
        raise RuntimeError("AccessDeniedException")

    pool.user_exists = refuse  # type: ignore[method-assign]
    user = await _owner(session)

    res = await client.post(REQUEST, json={"email": user.email})

    assert res.status_code == 200
    assert await _stored_link(session, user.id) is not None
    assert "AdminGetUser" in caplog.text
