"""The session vault: what the browser holds, and what it never holds.

The contract these pin: a Cognito refresh token goes into the database
encrypted and never comes back out over the wire, the browser gets an opaque
handle instead, and renewal is a server-side operation that re-checks the
account is still approved.
"""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import crypto
from app.core.enums import UserStatus
from app.modules.auth.models import AuthSession
from app.modules.users.models import User
from tests.api.cognito_fake import MAGIC_TOKEN, POOL_REFRESH, POOL_SUB, FakePool
from tests.api.conftest import cognito_access_token, create_user
from tests.api.role_compat import UserRole

REQUEST = "/api/v1/auth/magic-link"
VERIFY = "/api/v1/auth/magic-link/verify"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
PROFILE = "/api/v1/users/profile"


async def _signed_in(
    client: AsyncClient, session: AsyncSession, email: str = "ada@example.com"
) -> User:
    """Take a user through the real sign-in, leaving the handle on the client."""
    user = await create_user(session, email=email, role=UserRole.USER, linked=False)
    await client.post(REQUEST, json={"email": email})
    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})
    assert res.status_code == 200, res.text
    return user


async def _sessions(session: AsyncSession) -> list[AuthSession]:
    rows = await session.execute(select(AuthSession))
    return list(rows.scalars())


async def test_signing_in_vaults_the_refresh_token_and_hands_back_only_a_handle(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _signed_in(client, session)

    rows = await _sessions(session)
    assert len(rows) == 1
    row = rows[0]
    assert row.user_id == user.id
    # Stored encrypted, and readable only with the key -- never as written.
    assert POOL_REFRESH not in row.refresh_token_enc
    assert crypto.decrypt(row.refresh_token_enc) == POOL_REFRESH
    # The handle in the cookie is not the value in the row either.
    handle = client.cookies.get("sessionId")
    assert handle is not None
    assert handle != row.token_hash


async def test_the_pool_refresh_token_never_reaches_the_client(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await create_user(session, email="ada@example.com", role=UserRole.USER, linked=False)
    await client.post(REQUEST, json={"email": "ada@example.com"})

    res = await client.post(VERIFY, json={"token": MAGIC_TOKEN})

    body = res.text
    assert POOL_REFRESH not in body
    assert "refreshToken" not in body
    # The handle it does get is HttpOnly, so no script can read that either.
    cookie = res.headers["set-cookie"]
    assert cookie.startswith("sessionId=")
    assert "HttpOnly" in cookie
    assert POOL_REFRESH not in cookie


async def test_refresh_spends_the_vaulted_token_and_returns_a_new_access_token(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await _signed_in(client, session)

    res = await client.post(REFRESH)

    assert res.status_code == 200, res.text
    assert pool.exchanged == [POOL_REFRESH]
    data = res.json()["data"]
    assert data["accessToken"] == pool.access_token
    assert data["expiresIn"] == 900
    assert "refreshToken" not in data


async def test_a_rotated_refresh_token_is_re_vaulted_without_the_client_noticing(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await _signed_in(client, session)
    before = client.cookies.get("sessionId")

    await client.post(REFRESH)

    rows = await _sessions(session)
    assert crypto.decrypt(rows[0].refresh_token_enc) == POOL_REFRESH + "-rotated"
    # Same handle: rotation happened entirely behind the cookie.
    assert client.cookies.get("sessionId") == before


async def test_refresh_keeps_the_stored_token_when_the_pool_does_not_rotate(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    pool.rotates = False
    await _signed_in(client, session)

    res = await client.post(REFRESH)

    assert res.status_code == 200
    rows = await _sessions(session)
    assert crypto.decrypt(rows[0].refresh_token_enc) == POOL_REFRESH


async def test_refresh_stops_once_an_admin_removes_access(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _signed_in(client, session)
    user.status = UserStatus.REJECTED
    await session.flush()

    res = await client.post(REFRESH)

    assert res.status_code == 401
    assert pool.exchanged == []


async def test_refresh_without_a_session_cookie_is_rejected(
    client: AsyncClient, pool: FakePool, roles: None
) -> None:
    res = await client.post(REFRESH)

    assert res.status_code == 401
    assert pool.exchanged == []


async def test_a_handle_the_vault_cannot_decrypt_ends_the_session(
    client: AsyncClient,
    session: AsyncSession,
    pool: FakePool,
    roles: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # why: a changed vault key must not leave a row that fails forever. The
    # session is ended so the next sign-in starts clean.
    await _signed_in(client, session)
    rows = await _sessions(session)
    rows[0].refresh_token_enc = "not-a-fernet-token"
    await session.flush()

    res = await client.post(REFRESH)

    assert res.status_code == 401
    await session.refresh(rows[0])
    assert rows[0].revoked_at is not None


async def test_logout_revokes_here_and_at_the_pool(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await _signed_in(client, session)

    res = await client.post(LOGOUT)

    assert res.status_code == 200, res.text
    assert pool.revoked == [POOL_REFRESH]
    rows = await _sessions(session)
    assert rows[0].revoked_at is not None
    assert not client.cookies.get("sessionId")


async def test_a_revoked_session_cannot_refresh(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await _signed_in(client, session)
    handle = client.cookies.get("sessionId")
    await client.post(LOGOUT)
    client.cookies.set("sessionId", handle or "")

    res = await client.post(REFRESH)

    assert res.status_code == 401


async def test_logout_with_nothing_to_revoke_still_succeeds(
    client: AsyncClient, pool: FakePool, roles: None
) -> None:
    res = await client.post(LOGOUT)

    assert res.status_code == 200
    assert pool.revoked == []


async def test_signing_out_one_device_leaves_the_other_signed_in(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await _signed_in(client, session)
    laptop = client.cookies.get("sessionId")
    # A second sign-in from another device opens a second row. A fresh link,
    # because magic_link_tokens.token_hash is unique -- as it must be.
    second_link = MAGIC_TOKEN + "-second-device"
    pool.magic_token = second_link
    await client.post(REQUEST, json={"email": "ada@example.com"})
    await client.post(VERIFY, json={"token": second_link})
    phone = client.cookies.get("sessionId")
    assert laptop != phone

    client.cookies.set("sessionId", laptop or "")
    await client.post(LOGOUT)

    client.cookies.set("sessionId", phone or "")
    assert (await client.post(REFRESH)).status_code == 200


async def test_a_pool_access_token_authenticates_without_an_email_claim(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    # why: a Cognito ACCESS token carries no `email` claim. Resolving the local
    # row by `sub` is what makes it usable; an email-first lookup rejected it.
    user = await create_user(
        session, email="grace@example.com", role=UserRole.USER, cognito_sub=POOL_SUB
    )

    res = await client.get(PROFILE, headers={"Authorization": f"Bearer {pool.access_token}"})

    assert res.status_code == 200, res.text
    assert res.json()["data"]["email"] == user.email


async def test_an_id_token_is_not_accepted_as_a_credential(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await create_user(session, email="grace@example.com", role=UserRole.USER, cognito_sub=POOL_SUB)
    id_token = cognito_access_token(sub=POOL_SUB, email="grace@example.com")
    import jwt as pyjwt

    from tests.api.conftest import COGNITO_CLIENT_ID, COGNITO_ISSUER, PRIVATE_PEM

    claims: dict[str, Any] = pyjwt.decode(id_token, options={"verify_signature": False})
    claims["token_use"] = "id"
    claims["aud"] = COGNITO_CLIENT_ID
    claims["iss"] = COGNITO_ISSUER
    forged = pyjwt.encode(claims, PRIVATE_PEM, algorithm="RS256")

    res = await client.get(PROFILE, headers={"Authorization": f"Bearer {forged}"})

    assert res.status_code == 401


async def test_an_unknown_pool_identity_is_not_adopted_onto_someone_elses_row(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    await create_user(
        session, email="taken@example.com", role=UserRole.USER, cognito_sub="a-different-sub"
    )

    token = cognito_access_token(sub=POOL_SUB, email="taken@example.com")
    res = await client.get(PROFILE, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 401


async def test_no_session_rows_survive_a_user_being_deleted(
    client: AsyncClient, session: AsyncSession, pool: FakePool, roles: None
) -> None:
    user = await _signed_in(client, session)
    await session.delete(user)
    await session.flush()

    assert await session.scalar(select(func.count()).select_from(AuthSession)) == 0
