from fastapi import APIRouter, Depends, Request, Response

from app.core.constants import Messages
from app.core.cookies import clear_session_cookie, read_session_cookie, set_session_cookie
from app.core.deps import SessionDep
from app.core.envelope import ApiResponse, ok
from app.core.errors import UnauthorizedError
from app.core.rate_limit import RateLimiter, rate_limit_default
from app.modules.auth.schemas import (
    MagicLinkRequestIn,
    MagicLinkRequestOut,
    MagicLinkSessionOut,
    MagicLinkVerifyIn,
    MessageOut,
    SessionOut,
)
from app.modules.auth.sessions import SESSION_ENDED
from app.modules.cognito import passwordless
from app.modules.cognito import session as cognito_session

NO_STORE = "no-store"
REFRESH_LIMITER = RateLimiter(30, 60, name="auth-refresh")
MAGIC_LINK_LIMITER = RateLimiter(5, 15 * 60, name="auth-magic-link")
MAGIC_VERIFY_LIMITER = RateLimiter(10, 15 * 60, name="auth-magic-link-verify")

public_router = APIRouter(prefix="/auth", tags=["Auth"])


async def magic_link_limiter(request: Request, payload: MagicLinkRequestIn) -> None:
    MAGIC_LINK_LIMITER.check(request, payload.email)


async def magic_verify_limiter(request: Request) -> None:
    MAGIC_VERIFY_LIMITER.check(request)


async def refresh_limiter(request: Request) -> None:
    """Rate-limit a renewal per session, not per source address.

    Renewals are issued by the Next.js server on the user's behalf, so every
    user in the deployment arrives from one IP. Keying on the address gave the
    whole deployment a single bucket, and exceeding it made the caller read the
    429 as a dead session and sign people out while their session was fine.
    """
    REFRESH_LIMITER.check(request, read_session_cookie(request) or "")


@public_router.post(
    "/magic-link",
    dependencies=[Depends(magic_link_limiter)],
    summary="Request a sign-in link",
)
async def request_magic_link(
    payload: MagicLinkRequestIn, session: SessionDep
) -> ApiResponse[MagicLinkRequestOut]:
    result = await passwordless.request_link(session, payload.email)
    message = Messages.SIGNUP_RECEIVED if result.signup_requested else Messages.MAGIC_LINK_SENT
    return ok(result, message=message)


@public_router.post(
    "/magic-link/verify",
    dependencies=[Depends(magic_verify_limiter)],
    summary="Exchange a sign-in link for a session",
)
async def verify_magic_link(
    payload: MagicLinkVerifyIn, session: SessionDep, response: Response
) -> ApiResponse[MagicLinkSessionOut]:
    result, handle = await passwordless.verify_link(session, payload.token)
    response.headers["Cache-Control"] = NO_STORE
    set_session_cookie(response, handle)
    return ok(result, message=result.message)


@public_router.post(
    "/refresh", dependencies=[Depends(refresh_limiter)], summary="Renew the access token"
)
async def refresh(
    request: Request, session: SessionDep, response: Response
) -> ApiResponse[SessionOut]:
    handle = read_session_cookie(request)
    if not handle:
        raise UnauthorizedError(SESSION_ENDED)
    access_token, expires_in = await cognito_session.refresh(session, handle)
    response.headers["Cache-Control"] = NO_STORE
    return ok(
        SessionOut(
            access_token=access_token,
            expires_in=expires_in,
            message=Messages.TOKEN_REFRESHED,
        ),
        message=Messages.TOKEN_REFRESHED,
    )


@public_router.post("/logout", dependencies=[Depends(rate_limit_default)], summary="Log out")
async def logout(
    request: Request, session: SessionDep, response: Response
) -> ApiResponse[MessageOut]:
    # why: sign-out is idempotent. A caller with no session left to present
    # still gets its cookie cleared rather than an error it cannot act on.
    handle = read_session_cookie(request)
    if handle:
        await cognito_session.close(session, handle)
    clear_session_cookie(response)
    return ok(MessageOut(message=Messages.LOGGED_OUT), message=Messages.LOGGED_OUT)
