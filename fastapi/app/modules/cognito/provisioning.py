"""Creating the pool user an approved address signs in as."""

from __future__ import annotations

import logging

from app.core.errors import ConflictError, ServiceUnavailableError
from app.modules.cognito.client import CognitoClient

logger = logging.getLogger("app.cognito.provisioning")

PROVISION_FAILED = "Could not create the sign-in account for this address. Please try again."


def ensure_pool_user(client: CognitoClient, email: str) -> None:
    """Make sure the pool knows this address, or raise rather than guess.

    why: InitiateAuth answers for an address the pool has never seen. It returns
    a decoy CUSTOM_CHALLENGE with a fabricated sub, so sign-in cannot be used to
    enumerate accounts -- but the CreateAuthChallenge trigger still runs, so the
    reply carries a real-looking `magic_token` and a real Session. Nothing
    downstream can tell that apart from a genuine challenge: the link is stored,
    emailed and clicked, and only then does RespondToAuthChallenge fail with
    NotAuthorizedException. Every unprovisioned account therefore got a sign-in
    link that could never work. The existence check belongs here, before a link
    is ever sent, and a failure it cannot resolve must stop the send.
    """
    try:
        exists = client.user_exists(username=email)
    except Exception:
        # why: the lookup needs cognito-idp:AdminGetUser, and a deployment
        # without it must not lose sign-in for everyone the pool already holds.
        # Carrying on is no worse than never checking, which is what this did
        # before -- but say so, because a first-time address will get a link
        # that cannot work until the permission is granted.
        logger.warning(
            "Could not check the pool for this address; grant cognito-idp:AdminGetUser "
            "and cognito-idp:AdminCreateUser or a first sign-in cannot work",
            exc_info=True,
        )
        return
    if exists:
        return
    logger.info("Provisioning a Cognito user for a first-time address")
    try:
        client.admin_create_user(email=email)
    except ConflictError:
        # A concurrent request provisioned it first; the pool has it either way.
        return


def provision_user(email: str, *, client: CognitoClient | None = None) -> None:
    """Create the pool user for a newly approved address, or raise 503."""
    try:
        ensure_pool_user(client or CognitoClient(), email)
    except Exception as exc:
        logger.exception("Could not provision a Cognito user for an approved signup")
        raise ServiceUnavailableError(PROVISION_FAILED) from exc
