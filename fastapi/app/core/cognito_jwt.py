from functools import cache
from typing import Any, Literal

import jwt
from pydantic import BaseModel, ConfigDict, ValidationError

from app.core.config import Settings, settings
from app.core.errors import UnauthorizedError

COGNITO_ALGORITHMS = ["RS256"]


class CognitoTokenClaims(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sub: str
    email: str | None = None
    username: str | None = None
    token_use: Literal["id", "access"]
    iss: str
    client_id: str | None = None
    aud: str | list[str] | None = None

    @property
    def login_email(self) -> str | None:
        for candidate in (self.email, self.username):
            if candidate and "@" in candidate:
                return candidate.lower()
        return None


@cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)


def decode_cognito_token(token: str, *, cfg: Settings | None = None) -> CognitoTokenClaims:
    active = cfg or settings
    if not active.cognito_configured:
        raise UnauthorizedError("Cognito is not configured")
    try:
        signing_key = _jwks_client(active.cognito_jwks_url).get_signing_key_from_jwt(token)
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=COGNITO_ALGORITHMS,
            issuer=active.cognito_issuer,
            options={"require": ["exp", "iat", "sub", "iss"], "verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        # why: PyJWKClientError (unknown kid, JWKS fetch failure) is a PyJWTError
        # but not an InvalidTokenError, so catching the narrower class let a
        # Cognito outage surface as a 500 instead of a 401.
        raise UnauthorizedError("Invalid or expired token") from exc

    token_use = payload.get("token_use")
    allowed = active.cognito_client_ids
    if not allowed:
        # why: guarding the checks below with `if allowed` meant an empty client
        # list disabled audience validation altogether, accepting any token from
        # the pool -- including one minted for a different app client.
        raise UnauthorizedError("Cognito is not configured")
    if token_use == "id":
        audience = payload.get("aud")
        audiences = {audience} if isinstance(audience, str) else set(audience or [])
        if audiences.isdisjoint(allowed):
            raise UnauthorizedError("Invalid or expired token")
    elif token_use == "access":
        if payload.get("client_id") not in allowed:
            raise UnauthorizedError("Invalid or expired token")
    else:
        raise UnauthorizedError("Invalid or expired token")

    username = payload.get("email") or payload.get("username") or payload.get("cognito:username")
    try:
        return CognitoTokenClaims.model_validate(
            {**payload, "username": username, "email": payload.get("email")}
        )
    except ValidationError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
