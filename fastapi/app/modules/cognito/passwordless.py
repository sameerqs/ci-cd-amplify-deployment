"""Cognito passwordless sign-in over the CUSTOM_AUTH flow.

One email-only screen, a one-time link, no password anywhere. Cognito's
CreateAuthChallenge trigger mints the token and returns it in
ChallengeParameters, this module emails it, and VerifyAuthChallengeResponse
checks the answer -- so the pool, not this database, decides whether a link is
good. The local row exists only to carry Cognito's opaque Session string
between the two calls and to make the link single-use on our side as well.

Requires the three custom-auth Lambda triggers on the pool; see
`lambdas/cognito_custom_auth/README.md` for the contract they must satisfy.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import Messages
from app.core.deps import account_access_denied
from app.core.enums import UserStatus
from app.core.errors import UnauthorizedError
from app.core.mailer import send_email
from app.core.security import sha256_hex
from app.core.utils import utc_now
from app.modules.auth.models import MagicLinkToken
from app.modules.auth.schemas import MagicLinkRequestOut, MagicLinkSessionOut
from app.modules.auth.service import MAGIC_LINK_EXPIRED, find_or_queue_user
from app.modules.cognito.client import CognitoClient
from app.modules.cognito.provisioning import ensure_pool_user
from app.modules.cognito.session import open_session
from app.modules.users.models import User

logger = logging.getLogger("app.cognito.passwordless")

CHALLENGE_TOKEN_KEY = "magic_token"


def _challenge_token(response: dict[str, Any]) -> str | None:
    if response.get("ChallengeName") != "CUSTOM_CHALLENGE":
        return None
    parameters = response.get("ChallengeParameters") or {}
    token = parameters.get(CHALLENGE_TOKEN_KEY)
    return token if isinstance(token, str) and token else None


async def request_link(
    session: AsyncSession, email: str, *, client: CognitoClient | None = None
) -> MagicLinkRequestOut:
    """Start CUSTOM_AUTH and email the token Cognito minted.

    An unknown address only files a signup request; a pending or rejected
    request, or an existing account that is not active, raises with its own
    message (see `find_or_queue_user`).
    """
    lookup = await find_or_queue_user(session, email)
    if lookup.signup_requested:
        return MagicLinkRequestOut(signup_requested=True)
    user = lookup.user
    if user is None:
        return MagicLinkRequestOut()

    try:
        idp = client or CognitoClient()
        # why: sign-in still provisions on demand -- invited users and the
        # seeded Super Admin reach the pool this way, not through approval.
        ensure_pool_user(idp, email)
        challenge = idp.start_passwordless(email=email)
    except Exception:
        # why: an unconfigured or unreachable pool would otherwise answer 503
        # here and 200 for every address that has no approved account -- which
        # turns an outage into an account-existence oracle. Fail the same way
        # the caller already sees, and make it loud in the log instead. Sending
        # no link is the point: a link this backend could not stand behind is
        # worse than none, because it fails at the far end with nothing to say.
        logger.exception("Could not provision or challenge this address; no link sent")
        return MagicLinkRequestOut()

    raw = _challenge_token(challenge)
    cognito_session = challenge.get("Session")
    if raw is None or not cognito_session:
        # why: this means the pool's Lambda triggers are missing or not returning
        # the agreed key. Say nothing useful to the caller, but make it loud in
        # the log -- it is a deployment fault, not a user error.
        logger.error(
            "Cognito custom challenge did not return %r; check the pool's "
            "CreateAuthChallenge trigger",
            CHALLENGE_TOKEN_KEY,
        )
        return MagicLinkRequestOut()

    ttl = settings.MAGIC_LINK_TOKEN_TTL_SECONDS
    session.add(
        MagicLinkToken(
            token_hash=sha256_hex(raw),
            user_id=user.id,
            expires_at=utc_now() + timedelta(seconds=ttl),
            cognito_session=cognito_session,
            created_by_id=user.id,
            updated_by_id=user.id,
        )
    )
    await session.commit()

    magic_url = f"{settings.FRONTEND_URL}/auth/verify?token={raw}"
    sent = await send_email(
        user.email,
        f"{settings.APP_NAME} sign-in link",
        "magic-link.html",
        display_name=user.display_name,
        magic_url=magic_url,
        ttl_minutes=max(1, ttl // 60),
    )
    if not sent and settings.ENV == "development":
        # why: local dev has no SMTP, which would otherwise make the only way
        # into the app impossible to reach. Never outside development -- a
        # sign-in link in a log is a credential.
        logger.warning("DEV sign-in link for %s: %s", user.email, magic_url)
    return MagicLinkRequestOut()


async def verify_link(
    session: AsyncSession, raw_token: str, *, client: CognitoClient | None = None
) -> tuple[MagicLinkSessionOut, str]:
    """Answer the custom challenge and open a session. Returns (payload, handle)."""
    idp = client or CognitoClient()
    now = utc_now()
    # why: claim the row in one statement so two redemptions of the same link
    # cannot both reach Cognito.
    claimed = await session.execute(
        update(MagicLinkToken)
        .where(
            MagicLinkToken.token_hash == sha256_hex(raw_token),
            MagicLinkToken.consumed_at.is_(None),
            MagicLinkToken.expires_at > now,
        )
        .values(consumed_at=now)
        .returning(MagicLinkToken.user_id, MagicLinkToken.cognito_session)
    )
    row = claimed.first()
    if row is None:
        raise UnauthorizedError(MAGIC_LINK_EXPIRED)

    user_id, cognito_session = row
    user = await session.scalar(select(User).where(User.id == user_id, User.is_deleted.is_(False)))
    if user is None or not cognito_session:
        await session.commit()
        raise UnauthorizedError(MAGIC_LINK_EXPIRED)
    if user.status is not UserStatus.ACTIVE:
        # The link went out, then an admin took access away before it was used.
        await session.commit()
        raise account_access_denied(user.status)

    try:
        answered = idp.answer_passwordless(
            email=user.email, session=cognito_session, answer=raw_token
        )
    except Exception:
        # why: the pool's own wording ("Unable to complete the Cognito request")
        # reached the sign-in screen and told the visitor nothing they could act
        # on. Whatever the pool's reason, the only thing they can do is ask for
        # a fresh link, so say that -- and keep the real reason in the log.
        logger.exception("Cognito rejected the challenge answer")
        await session.commit()
        raise UnauthorizedError(MAGIC_LINK_EXPIRED) from None

    authentication = answered.get("AuthenticationResult")
    if not authentication:
        await session.commit()
        raise UnauthorizedError(MAGIC_LINK_EXPIRED)

    # why: the pool has now vouched for this address, so record the identity it
    # vouched for. sub is stable where the email is not. A token this service
    # cannot verify is not one it will build a session on, so a missing sub
    # fails the sign-in rather than falling through.
    sub = _sub_from_tokens(authentication)
    if sub is None:
        await session.commit()
        raise UnauthorizedError(MAGIC_LINK_EXPIRED)
    if user.cognito_sub not in (None, sub) and not _may_rebind(idp, str(user.cognito_sub)):
        logger.error("Cognito returned a different sub for an already-linked account")
        await session.commit()
        raise UnauthorizedError(MAGIC_LINK_EXPIRED)
    user.cognito_sub = sub

    access_token, expires_in, handle = await open_session(session, authentication, user)
    await session.commit()
    payload = MagicLinkSessionOut(
        access_token=access_token,
        expires_in=expires_in,
        message=Messages.LOGIN_SUCCESS,
        onboarding_completed_at=user.onboarding_completed_at,
    )
    return payload, handle


def _may_rebind(client: CognitoClient, stored_sub: str) -> bool:
    """Whether an account bound to `stored_sub` may adopt a different identity.

    Only when the pool no longer holds the identity it is bound to -- which is
    what a rebuilt or re-seeded pool leaves behind, and which otherwise locks
    the account out for good with nothing but a misleading "link expired". While
    both identities exist, refusing is the point: two pool users must never end
    up sharing one account. An unanswerable lookup refuses as well.
    """
    try:
        return not client.user_exists(username=stored_sub)
    except Exception:
        logger.exception("Could not check whether the previously linked pool user still exists")
        return False


def _sub_from_tokens(authentication: dict[str, Any]) -> str | None:
    """Read `sub` from the freshly issued access token, verifying it first."""
    from app.core.cognito_jwt import decode_cognito_token

    access_token = authentication.get("AccessToken")
    if not isinstance(access_token, str):
        return None
    try:
        return decode_cognito_token(access_token).sub
    except UnauthorizedError:
        logger.warning("Cognito issued a token this service could not verify")
        return None
