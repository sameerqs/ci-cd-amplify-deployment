from datetime import datetime

from pydantic import Field

from app.core.schemas import EmailLower, InputSchema, OutputSchema


class SessionOut(OutputSchema):
    """What a client gets from signing in or refreshing.

    The access token only. The session handle that renews it is set as an
    HttpOnly cookie and is never part of a body a script could read.
    """

    access_token: str
    expires_in: int
    message: str


class MessageOut(OutputSchema):
    message: str


class MagicLinkRequestIn(InputSchema):
    email: EmailLower


class MagicLinkVerifyIn(InputSchema):
    token: str = Field(min_length=16, max_length=128)


class MagicLinkRequestOut(OutputSchema):
    """Response to "send me a link".

    `signup_requested` is true only when this call filed a new signup request.
    Every existing account gets the same reply whether or not a link went out.
    """

    signup_requested: bool = False


class MagicLinkSessionOut(SessionOut):
    """Session plus the one fact the client needs to pick a landing screen.

    Carried on the response so verifying a link does not need a second
    round-trip to /users/profile before it can redirect.
    """

    onboarding_completed_at: datetime | None
