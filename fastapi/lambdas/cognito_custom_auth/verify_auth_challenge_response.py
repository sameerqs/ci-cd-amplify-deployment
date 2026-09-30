"""VerifyAuthChallengeResponse — checks the token the user came back with.

Deploy as the pool's Verify Auth Challenge Response trigger.
"""

import hmac
from typing import Any


def lambda_handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    expected = (event["request"].get("privateChallengeParameters") or {}).get("answer") or ""
    provided = event["request"].get("challengeAnswer") or ""
    # why: constant-time compare. A timing difference here leaks the token one
    # character at a time.
    event["response"]["answerCorrect"] = bool(expected) and hmac.compare_digest(
        str(expected), str(provided)
    )
    return event
