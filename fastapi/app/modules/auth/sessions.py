"""The session store, and the only place a Cognito refresh token is handled.

A session is a row plus an opaque handle. The handle goes to the browser in an
HttpOnly cookie; its SHA-256 goes in the row. Cognito's refresh token never
leaves this process -- it is encrypted on the way in and decrypted only to be
spent against the pool, so a stolen cookie is worth nothing without this
service and can be revoked the moment it is reported.
"""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import crypto
from app.core.config import settings
from app.core.enums import UserStatus
from app.core.errors import UnauthorizedError
from app.core.security import new_opaque_token, sha256_hex
from app.core.utils import utc_now
from app.modules.auth.models import AuthSession
from app.modules.users.models import User

SESSION_ENDED = "The session has ended. Sign in again to continue."


async def issue(session: AsyncSession, user_id: UUID, refresh_token: str) -> str:
    """Open a session for one device and return its handle. Never stored raw."""
    raw = new_opaque_token()
    now = utc_now()
    session.add(
        AuthSession(
            token_hash=sha256_hex(raw),
            user_id=user_id,
            refresh_token_enc=crypto.encrypt(refresh_token),
            expires_at=now + settings.session_ttl,
            last_used_at=now,
            created_by_id=user_id,
            updated_by_id=user_id,
        )
    )
    await session.flush()
    return raw


async def resolve(session: AsyncSession, raw: str) -> tuple[User, AuthSession, str]:
    """Trade a handle for its user and Cognito refresh token.

    Every reason to refuse -- unknown handle, revoked, expired, account no
    longer active, a secret this key cannot read -- answers the same way. The
    caller learns the session is over and nothing about why.
    """
    row = await session.scalar(select(AuthSession).where(AuthSession.token_hash == sha256_hex(raw)))
    now = utc_now()
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise UnauthorizedError(SESSION_ENDED)

    user = await session.scalar(
        select(User).where(
            User.id == row.user_id,
            User.is_deleted.is_(False),
            User.status == UserStatus.ACTIVE,
        )
    )
    if user is None:
        raise UnauthorizedError(SESSION_ENDED)

    try:
        refresh_token = crypto.decrypt(row.refresh_token_enc)
    except crypto.VaultError as exc:
        # why: the vault key changed or the row is damaged. The session cannot be
        # continued and cannot be recovered, so end it rather than leave a row
        # that fails this way on every attempt.
        row.revoked_at = now
        row.is_deleted = True
        await session.flush()
        raise UnauthorizedError(SESSION_ENDED) from exc

    row.last_used_at = now
    return user, row, refresh_token


async def store_rotated(session: AsyncSession, row: AuthSession, refresh_token: str) -> None:
    """Replace the vaulted refresh token after Cognito rotated it."""
    row.refresh_token_enc = crypto.encrypt(refresh_token)
    row.updated_by_id = row.user_id
    await session.flush()


async def peek_refresh_token(session: AsyncSession, raw: str) -> str | None:
    """The vaulted refresh token for a handle, or None for any reason at all.

    Sign-out only: it is best effort by design, so an already-revoked or
    undecryptable session must not raise on the way out.
    """
    row = await session.scalar(select(AuthSession).where(AuthSession.token_hash == sha256_hex(raw)))
    if row is None:
        return None
    try:
        return crypto.decrypt(row.refresh_token_enc)
    except crypto.VaultError:
        return None


async def revoke(session: AsyncSession, raw: str) -> UUID | None:
    result = await session.execute(
        update(AuthSession)
        .where(AuthSession.token_hash == sha256_hex(raw), AuthSession.revoked_at.is_(None))
        .values(revoked_at=utc_now(), is_deleted=True)
        .returning(AuthSession.user_id)
    )
    return result.scalar_one_or_none()


async def revoke_all_for_users(session: AsyncSession, user_ids: Sequence[UUID]) -> None:
    """End every session these users hold. Used when an admin removes access."""
    if not user_ids:
        return
    await session.execute(
        update(AuthSession)
        .where(AuthSession.user_id.in_(user_ids), AuthSession.revoked_at.is_(None))
        .values(revoked_at=utc_now(), is_deleted=True)
    )
