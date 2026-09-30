"""DefineAuthChallenge — decides what happens next in the CUSTOM_AUTH flow.

Deploy as the pool's Define Auth Challenge trigger.

The whole flow is exactly one custom challenge: issue it, then accept or reject
the answer. There is no password stage and no fallback to one, so a caller
cannot negotiate their way onto a weaker flow.
"""

from typing import Any

MAX_ATTEMPTS = 3


def lambda_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    sessions = event["request"].get("session") or []
    response = event["response"]

    if not sessions:
        response["challengeName"] = "CUSTOM_CHALLENGE"
        response["issueTokens"] = False
        response["failAuthentication"] = False
        return event

    last = sessions[-1]
    if last.get("challengeName") == "CUSTOM_CHALLENGE" and last.get("challengeResult"):
        response["issueTokens"] = True
        response["failAuthentication"] = False
        return event

    # why: a wrong answer gets a small, fixed number of tries rather than an
    # endless supply -- the token is short and emailed, so brute force is the
    # realistic attack.
    if len(sessions) >= MAX_ATTEMPTS:
        response["issueTokens"] = False
        response["failAuthentication"] = True
        return event

    response["challengeName"] = "CUSTOM_CHALLENGE"
    response["issueTokens"] = False
    response["failAuthentication"] = False
    return event
