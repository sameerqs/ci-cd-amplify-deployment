"""The session cookie, written in one place.

It carries an opaque handle -- never a Cognito token, never anything a script
could replay against AWS. HttpOnly so no script can read it at all, Secure
outside development, SameSite=lax so it rides a top-level navigation but not a
cross-site request. The access token is not written here: it goes back in the
response body and the caller decides where to keep it.
"""

from typing import Literal

from fastapi import Request, Response

from app.core.config import settings

SESSION_COOKIE = "sessionId"
COOKIE_PATH = "/"
SAME_SITE: Literal["lax"] = "lax"


def read_session_cookie(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE) or None


def set_session_cookie(response: Response, handle: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        handle,
        max_age=int(settings.session_ttl.total_seconds()),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=SAME_SITE,
        path=COOKIE_PATH,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=SAME_SITE,
    )
