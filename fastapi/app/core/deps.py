from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cognito_jwt import CognitoTokenClaims, decode_cognito_token
from app.core.constants import (
    ACCOUNT_NOT_APPROVED,
    ACCOUNT_PENDING_APPROVAL,
    ACCOUNT_SUSPENDED,
    Messages,
)
from app.core.enums import UserStatus
from app.core.errors import ForbiddenError, UnauthorizedError
from app.db.session import get_session
from app.modules.users.models import User

SessionDep = Annotated[AsyncSession, Depends(get_session)]
bearer_scheme = HTTPBearer(auto_error=False, scheme_name="access-token", bearerFormat="JWT")


class AuthUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    is_super_admin: bool
    display_name: str


def account_access_denied(status: UserStatus) -> ForbiddenError:
    if status is UserStatus.SUSPENDED:
        return ForbiddenError(Messages.ACCOUNT_SUSPENDED, code=ACCOUNT_SUSPENDED)
    if status is UserStatus.PENDING:
        return ForbiddenError(Messages.ACCOUNT_PENDING_APPROVAL, code=ACCOUNT_PENDING_APPROVAL)
    return ForbiddenError(Messages.ACCOUNT_NOT_APPROVED, code=ACCOUNT_NOT_APPROVED)


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthUser:
    """Identify the caller from a Cognito access token.

    Verification is the pool's signature, issuer, expiry and app client; the
    identity is `sub`. Authorisation stays here: a valid pool token still has to
    resolve to a local row that an admin has approved.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError()
    claims = decode_cognito_token(credentials.credentials)
    if claims.token_use == "id":  # noqa: S105 -- a claim name, not a credential
        # why: an ID token is for the client to read, not for authenticating a
        # request. Accepting one lets any consumer of it act as the user.
        raise UnauthorizedError()
    return AuthUser.model_validate(await resolve_cognito_user(session, claims))


async def resolve_cognito_user(session: AsyncSession, claims: CognitoTokenClaims) -> User:
    """Map a verified pool identity onto the local row.

    `sub` is the key. It is the only claim that is both stable for the life of
    the account and present on an ACCESS token -- a Cognito access token carries
    no `email` claim at all, so an email-first lookup rejected every one of
    them. Email is a one-time fallback that adopts a row created before Cognito
    knew the address; a row already bound to a different `sub` is not adopted,
    because that would put two pool identities on one account.
    """
    user = await session.scalar(
        select(User).where(User.cognito_sub == claims.sub, User.is_deleted.is_(False))
    )
    email = claims.login_email

    if user is None:
        if email is None:
            raise UnauthorizedError()
        user = await session.scalar(
            select(User).where(User.email == email, User.is_deleted.is_(False))
        )
        if user is None or user.cognito_sub is not None:
            raise UnauthorizedError()
        user.cognito_sub = claims.sub
        await session.flush()

    # why: authentication is Cognito's job, authorisation is ours. A valid pool
    # token on an unapproved account is a 403 with its own code, not a 401 --
    # the client reads a 401 as an expired session and would say nothing useful.
    if user.status is not UserStatus.ACTIVE:
        raise account_access_denied(user.status)
    if email is not None and user.email != email:
        user.email = email
        await session.flush()
    return user


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


async def require_super_admin(user: CurrentUser) -> AuthUser:
    if not user.is_super_admin:
        raise ForbiddenError("Access denied: Super Admin permission required")
    return user
