"""A stand-in for the Cognito user pool, shared by the auth tests.

It records what the service asked of it and hands back the shapes a real pool
does -- including the awkward ones: a challenge with no magic_token when the
Lambda triggers are missing, and a refresh that returns no new refresh token
when rotation is off.
"""

from typing import Any

from tests.api.conftest import cognito_access_token

MAGIC_TOKEN = "magic-token-long-enough-for-the-schema"
POOL_REFRESH = "pool-refresh-token." + "z" * 900
POOL_SUB = "11111111-2222-3333-4444-555555555555"


class FakePool:
    def __init__(self) -> None:
        self.magic_token: str | None = MAGIC_TOKEN
        self.session: str | None = "sess-abc"
        self.rotates = True
        self.authenticates = True
        self.sub = POOL_SUB
        # None means "the pool knows every address"; a set pins exactly which
        # ones it holds, which is how the provisioning path gets exercised.
        self.known_users: set[str] | None = None
        self.created: list[str] = []
        self.answered: list[tuple[str, str, str]] = []
        self.exchanged: list[str] = []
        self.revoked: list[str] = []

    @property
    def access_token(self) -> str:
        return cognito_access_token(sub=self.sub)

    def admin_get_user(self, *, username: str) -> dict[str, Any]:
        return {"Username": username}

    def user_exists(self, *, username: str) -> bool:
        return self.known_users is None or username in self.known_users

    def admin_create_user(self, *, email: str) -> dict[str, Any]:
        self.created.append(email)
        if self.known_users is not None:
            self.known_users.add(email)
        return {}

    def start_passwordless(self, *, email: str) -> dict[str, Any]:
        params = {"magic_token": self.magic_token} if self.magic_token else {}
        return {
            "ChallengeName": "CUSTOM_CHALLENGE",
            "Session": self.session,
            "ChallengeParameters": params,
        }

    def answer_passwordless(self, *, email: str, session: str, answer: str) -> dict[str, Any]:
        self.answered.append((email, session, answer))
        if not self.authenticates:
            return {"ChallengeName": "CUSTOM_CHALLENGE", "Session": "next"}
        return {
            "AuthenticationResult": {
                "AccessToken": self.access_token,
                "RefreshToken": POOL_REFRESH,
                "ExpiresIn": 900,
            }
        }

    def exchange_refresh_token(self, *, refresh_token: str) -> dict[str, Any]:
        self.exchanged.append(refresh_token)
        result: dict[str, Any] = {"AccessToken": self.access_token, "ExpiresIn": 900}
        if self.rotates:
            result["RefreshToken"] = POOL_REFRESH + "-rotated"
        return {"AuthenticationResult": result}

    def revoke_token(self, *, refresh_token: str) -> dict[str, Any]:
        self.revoked.append(refresh_token)
        return {}
