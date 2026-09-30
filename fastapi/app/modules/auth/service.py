"""Sign-in orchestration for the passwordless flow.

Cognito owns the challenge and issues the tokens; this module owns who is
allowed in. The split matters: the pool authenticates an address, and this
application still decides whether that address has been approved.
"""

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import account_access_denied
from app.core.enums import UserStatus
from app.modules.signups.service import queue_signup
from app.modules.users.models import User

logger = logging.getLogger("app.auth")

MAGIC_LINK_EXPIRED = "This sign-in link has expired or has already been used. Request a new one."


@dataclass(frozen=True, slots=True)
class SignInLookup:
    user: User | None = None
    signup_requested: bool = False


async def find_or_queue_user(session: AsyncSession, email: str) -> SignInLookup:
    """The account that may receive a link, or the signup request just filed.

    An address with no account files a signup request -- no user row, no pool
    user -- and `queue_signup` raises if one is already pending or was rejected.
    An existing account that is not active raises with the reason, so the owner
    is told why rather than waiting for a link that will never come. A deleted
    account yields an empty lookup, answered like a link that went out.
    """
    # why: users.email is unique across soft-deleted rows too, so filtering them
    # out here guaranteed an IntegrityError on insert that read as a race. That
    # address could then never sign in again and nothing said so.
    user = await session.scalar(select(User).where(User.email == email))

    if user is not None and user.is_deleted:
        logger.info("Sign-in link requested for a deleted account; ignoring")
        return SignInLookup()

    if user is None:
        await queue_signup(session, email)
        return SignInLookup(signup_requested=True)

    if user.status is not UserStatus.ACTIVE:
        raise account_access_denied(user.status)
    return SignInLookup(user=user)
