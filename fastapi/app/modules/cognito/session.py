"""The Cognito session lifecycle: open it, renew it, close it.

The pool issues the tokens and this module decides what the client is allowed
to hold. It gets the access token and an opaque handle; Cognito's refresh token
goes straight into the vault (app/modules/auth/sessions.py) and never crosses
the wire again. Renewal is therefore a server-side operation the browser cannot
perform even if its cookie is stolen, and rotation is invisible to it.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.modules.auth import sessions
from app.modules.auth.sessions import SESSION_ENDED
from app.modules.cognito.client import CognitoClient
from app.modules.users.models import User

logger = logging.getLogger("app.cognito.session")

# why: Cognito always sends ExpiresIn, but a session that silently assumed
# "forever" on a malformed reply would never refresh. An hour is the pool
# default, and being wrong here costs one early refresh, not a failure.
DEFAULT_EXPIRES_IN = 3600


def access_token_of(authentication: dict[str, Any]) -> tuple[str, int]:
    token = authentication.get("AccessToken")
    if not isinstance(token, str) or not token:
        logger.error("Cognito returned an AuthenticationResult with no access token")
        raise UnauthorizedError(SESSION_ENDED)
    expires = authentication.get("ExpiresIn")
    return token, expires if isinstance(expires, int) and expires > 0 else DEFAULT_EXPIRES_IN


async def open_session(
    session: AsyncSession, authentication: dict[str, Any], user: User
) -> tuple[str, int, str]:
    """Vault the pool's refresh token and return (access token, ttl, handle)."""
    access_token, expires_in = access_token_of(authentication)
    refresh_token = authentication.get("RefreshToken")
    if not isinstance(refresh_token, str) or not refresh_token:
        # why: without a refresh token the session cannot outlive one access
        # token. That means refresh tokens are switched off on the app client --
        # a deployment fault, and not something to paper over with a short session.
        logger.error("Cognito issued no refresh token; check the app client's token settings")
        raise UnauthorizedError(SESSION_ENDED)
    handle = await sessions.issue(session, user.id, refresh_token)
    return access_token, expires_in, handle


async def refresh(
    session: AsyncSession, handle: str, *, client: CognitoClient | None = None
) -> tuple[str, int]:
    """Spend the vaulted refresh token for a new access token.

    Called only once the access token has expired or been rejected -- never per
    request. The pool decides whether the refresh token still stands, and
    `resolve` re-checks that the account is still approved here, so an admin
    removing access takes effect at the next renewal rather than whenever
    Cognito's refresh token happens to run out.
    """
    user, row, refresh_token = await sessions.resolve(session, handle)
    idp = client or CognitoClient()
    try:
        answered = idp.exchange_refresh_token(refresh_token=refresh_token)
    except UnauthorizedError:
        # The pool has retired this token. The row can never succeed again.
        await sessions.revoke(session, handle)
        await session.commit()
        raise

    authentication = answered.get("AuthenticationResult")
    if not authentication:
        await sessions.revoke(session, handle)
        await session.commit()
        raise UnauthorizedError(SESSION_ENDED)

    access_token, expires_in = access_token_of(authentication)
    rotated = authentication.get("RefreshToken")
    if isinstance(rotated, str) and rotated and rotated != refresh_token:
        # Rotation is on. The client never learns, because it never held it.
        await sessions.store_rotated(session, row, rotated)
    logger.debug("Renewed a session for user %s", user.id)
    await session.commit()
    return access_token, expires_in


async def close(session: AsyncSession, handle: str, *, client: CognitoClient | None = None) -> None:
    """End this device's session here and at the pool.

    Scoped to the one handle presented, so signing out of a laptop leaves the
    phone alone. The local revoke is what actually ends it; reaching Cognito is
    best effort, because an unreachable pool must not keep a user signed in.
    """
    refresh_token = await sessions.peek_refresh_token(session, handle)
    await sessions.revoke(session, handle)
    await session.commit()
    if refresh_token is None:
        return
    try:
        idp = client or CognitoClient()
        idp.revoke_token(refresh_token=refresh_token)
    except Exception:
        logger.warning("Could not revoke the refresh token at Cognito", exc_info=True)
