"""CreateAuthChallenge — mints the one-time token for a sign-in link.

Deploy as the pool's Create Auth Challenge trigger.

The token is returned to the caller in `publicChallengeParameters` under the key
`magic_token`, which is the contract the backend reads
(`app/modules/cognito/passwordless.py::CHALLENGE_TOKEN_KEY`). The backend emails
it. The answer is kept in `privateChallengeParameters`, which never leaves
Cognito, so Verify can compare without trusting the client.

NOTE on the trade-off: putting the token in publicChallengeParameters means the
backend sees it. That is deliberate here -- this application owns the mail -- but
it does mean the challenge secret leaves Cognito. If you would rather it never
did, send the mail from inside this function via SES and return only a correlation
id in publicChallengeParameters.
"""

import secrets
from typing import Any

TOKEN_BYTES = 32


def lambda_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    session = event["request"].get("session") or []

    if session and session[-1].get("challengeName") == "CUSTOM_CHALLENGE":
        # A retry of the same challenge must reuse the token already emailed,
        # otherwise the link in the user's inbox stops working the moment they
        # mistype once.
        previous = session[-1].get("challengeMetadata")
        if previous:
            event["response"]["publicChallengeParameters"] = {"magic_token": previous}
            event["response"]["privateChallengeParameters"] = {"answer": previous}
            event["response"]["challengeMetadata"] = previous
            return event

    token = secrets.token_urlsafe(TOKEN_BYTES)
    event["response"]["publicChallengeParameters"] = {"magic_token": token}
    event["response"]["privateChallengeParameters"] = {"answer": token}
    event["response"]["challengeMetadata"] = token
    return event
