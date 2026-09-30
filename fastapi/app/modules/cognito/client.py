from __future__ import annotations

import logging
from typing import Any, Protocol

import boto3
from botocore.exceptions import ClientError

from app.core.config import Settings, settings
from app.core.errors import (
    BadRequestError,
    ConflictError,
    RateLimitedError,
    ServiceUnavailableError,
    UnauthorizedError,
)

logger = logging.getLogger("app.cognito")

GENERIC_AUTH_FAILURE = "Unable to complete the Cognito request."
USER_NOT_FOUND_OR_INVALID = "Unable to complete the request for that account."


class CognitoIdp(Protocol):
    """Exactly the boto3 operations `_call` dispatches to, and no others."""

    def initiate_auth(self, **kwargs: Any) -> dict[str, Any]: ...
    def respond_to_auth_challenge(self, **kwargs: Any) -> dict[str, Any]: ...
    def admin_get_user(self, **kwargs: Any) -> dict[str, Any]: ...
    def admin_create_user(self, **kwargs: Any) -> dict[str, Any]: ...
    def get_tokens_from_refresh_token(self, **kwargs: Any) -> dict[str, Any]: ...
    def revoke_token(self, **kwargs: Any) -> dict[str, Any]: ...


_ERROR_MAP: dict[str, type[Exception]] = {
    "UsernameExistsException": ConflictError,
    "AliasExistsException": ConflictError,
    "InvalidPasswordException": BadRequestError,
    "InvalidParameterException": BadRequestError,
    "CodeMismatchException": BadRequestError,
    "ExpiredCodeException": BadRequestError,
    "NotAuthorizedException": UnauthorizedError,
    "UserNotConfirmedException": BadRequestError,
    "PasswordResetRequiredException": BadRequestError,
    "EnableSoftwareTokenMFAException": BadRequestError,
    "SoftwareTokenMFANotFoundException": BadRequestError,
    "InvalidUserPoolConfigurationException": ServiceUnavailableError,
    "CodeDeliveryFailureException": ServiceUnavailableError,
    "TooManyRequestsException": RateLimitedError,
    "LimitExceededException": RateLimitedError,
}


def translate_client_error(exc: ClientError, *, leak_detail: bool = False) -> Exception:
    code = exc.response.get("Error", {}).get("Code", "")
    detail = exc.response.get("Error", {}).get("Message", GENERIC_AUTH_FAILURE)
    if code == "UserNotFoundException":
        return UnauthorizedError(USER_NOT_FOUND_OR_INVALID)
    mapped = _ERROR_MAP.get(code)
    if mapped is RateLimitedError:
        return RateLimitedError(60)
    if mapped is UnauthorizedError:
        return UnauthorizedError(detail if leak_detail else GENERIC_AUTH_FAILURE)
    if mapped is ConflictError:
        message = detail if leak_detail else "An account with that email already exists."
        return ConflictError(message)
    if mapped is BadRequestError:
        return BadRequestError(detail)
    if mapped is ServiceUnavailableError:
        return ServiceUnavailableError(detail)
    logger.warning("unmapped cognito error %s", code)
    return BadRequestError(GENERIC_AUTH_FAILURE)


class CognitoClient:
    """The boto3 surface this application actually uses.

    Deliberately narrow: the passwordless flow needs to look a user up, create
    one, run the custom challenge, spend a refresh token and revoke it. Nothing
    else here talks to Cognito, so nothing else belongs in this wrapper.
    """

    def __init__(
        self,
        *,
        cfg: Settings | None = None,
        idp: CognitoIdp | None = None,
    ) -> None:
        self.cfg = cfg or settings
        if not self.cfg.cognito_configured:
            raise ServiceUnavailableError("Cognito is not configured")
        # why: boto3 only receives credentials that are actually configured.
        # Passing None for both leaves its own chain intact -- environment,
        # shared config, instance role -- which is how this runs in AWS.
        self.idp = idp or boto3.client(
            "cognito-idp",
            region_name=self.cfg.AWS_REGION,
            aws_access_key_id=self.cfg.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=self.cfg.aws_secret_access_key,
        )

    @property
    def client_id(self) -> str:
        return self.cfg.COGNITO_CLIENT_ID or ""

    def start_passwordless(self, *, email: str) -> dict[str, Any]:
        """Begin CUSTOM_AUTH and return Cognito's first challenge.

        Fires the pool's DefineAuthChallenge and CreateAuthChallenge triggers.
        The reply carries a Session string, which must be handed back when the
        challenge is answered, and ChallengeParameters, where CreateAuthChallenge
        places the one-time token this backend emails.
        """
        return self._call(
            "initiate_auth",
            {
                "ClientId": self.client_id,
                "AuthFlow": "CUSTOM_AUTH",
                "AuthParameters": {"USERNAME": email},
            },
        )

    def answer_passwordless(self, *, email: str, session: str, answer: str) -> dict[str, Any]:
        """Answer the custom challenge, invoking VerifyAuthChallengeResponse."""
        return self._call(
            "respond_to_auth_challenge",
            {
                "ClientId": self.client_id,
                "ChallengeName": "CUSTOM_CHALLENGE",
                "Session": session,
                "ChallengeResponses": {"USERNAME": email, "ANSWER": answer},
            },
        )

    def admin_create_user(self, *, email: str) -> dict[str, Any]:
        """Create a pool user with no password.

        MessageAction=SUPPRESS because this app sends its own mail; letting
        Cognito send an invite would deliver a temporary password that the
        passwordless flow has no use for.
        """
        return self._call(
            "admin_create_user",
            {
                "UserPoolId": self.cfg.COGNITO_USER_POOL_ID,
                "Username": email,
                "MessageAction": "SUPPRESS",
                "UserAttributes": [
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                ],
            },
        )

    def exchange_refresh_token(self, *, refresh_token: str) -> dict[str, Any]:
        """Exchange a refresh token for a fresh access and ID token.

        Uses GetTokensFromRefreshToken rather than REFRESH_TOKEN_AUTH: once the
        app client has refresh-token rotation switched on, that older flow can
        hand back a token which has already been retired.
        """
        return self._call(
            "get_tokens_from_refresh_token",
            {"RefreshToken": refresh_token, "ClientId": self.client_id},
        )

    def revoke_token(self, *, refresh_token: str) -> dict[str, Any]:
        """Revoke a refresh token and every access token minted from it.

        Needs "Revoke token" left enabled on the app client (it is by default).
        Cognito answers 200 for a token that is already revoked or was never
        valid, so sign-out can call this without first proving the token is good.
        """
        return self._call("revoke_token", {"Token": refresh_token, "ClientId": self.client_id})

    def admin_get_user(self, *, username: str) -> dict[str, Any]:
        return self._call(
            "admin_get_user",
            {"UserPoolId": self.cfg.COGNITO_USER_POOL_ID, "Username": username},
        )

    def user_exists(self, *, username: str) -> bool:
        """Whether the pool holds this user -- and nothing else read as "no".

        "Not found" is the one answer that means the user is absent. Every other
        failure (no credentials, AdminGetUser not granted, the pool unreachable)
        leaves the question unanswered, and a caller that treated those as "no"
        would go on to provision or to sign in against a pool it cannot see.
        """
        try:
            self.idp.admin_get_user(UserPoolId=self.cfg.COGNITO_USER_POOL_ID, Username=username)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "UserNotFoundException":
                return False
            raise translate_client_error(exc) from exc
        return True

    def _call(
        self, method: str, kwargs: dict[str, Any], *, leak_detail: bool = False
    ) -> dict[str, Any]:
        try:
            operation = getattr(self.idp, method)
            result = operation(**kwargs)
        except ClientError as exc:
            raise translate_client_error(exc, leak_detail=leak_detail) from exc
        if not isinstance(result, dict):
            raise ServiceUnavailableError(GENERIC_AUTH_FAILURE)
        return result
