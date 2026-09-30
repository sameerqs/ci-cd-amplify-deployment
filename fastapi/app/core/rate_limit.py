import math
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import Request

from app.core.cognito_jwt import decode_cognito_token
from app.core.config import settings
from app.core.errors import RateLimitedError, UnauthorizedError

MAX_TRACKED_KEYS = 10_000


@dataclass(slots=True)
class _Bucket:
    window_start: float
    count: int


class RateLimiter:
    def __init__(
        self,
        limit: int,
        window_seconds: float,
        *,
        name: str,
        now: Callable[[], float] = time.monotonic,
        max_keys: int = MAX_TRACKED_KEYS,
    ) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.name = name
        self._now = now
        self._max_keys = max_keys
        self._buckets: dict[str, _Bucket] = {}
        _REGISTRY.append(self)

    def hit(self, key: str) -> int | None:
        now = self._now()
        bucket = self._buckets.get(key)
        if bucket is None or now - bucket.window_start >= self.window_seconds:
            if len(self._buckets) >= self._max_keys:
                self._prune(now)
            self._buckets[key] = _Bucket(window_start=now, count=1)
            return None
        if bucket.count >= self.limit:
            return max(1, math.ceil(bucket.window_start + self.window_seconds - now))
        bucket.count += 1
        return None

    def check(self, request: Request, email: str | None = None) -> None:
        retry_after = self.hit(tracker_key(request, email))
        if retry_after is not None:
            raise RateLimitedError(retry_after)

    def reset(self) -> None:
        self._buckets.clear()

    def _prune(self, now: float) -> None:
        # ponytail: in-memory per process; swap for `limits`+Redis when running >1 worker.
        expired = [
            k for k, b in self._buckets.items() if now - b.window_start >= self.window_seconds
        ]
        for key in expired:
            del self._buckets[key]
        if len(self._buckets) >= self._max_keys:
            oldest = sorted(self._buckets.items(), key=lambda kv: kv[1].window_start)
            for key, _ in oldest[: len(oldest) // 2]:
                del self._buckets[key]


_REGISTRY: list[RateLimiter] = []


def reset_all_limiters() -> None:
    for limiter in _REGISTRY:
        limiter.reset()


def tracker_key(request: Request, email: str | None = None) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            # why: verified, not just decoded. Reading `sub` off an unverified
            # token would let anyone exhaust a chosen victim's bucket by
            # forging one. The JWKS is cached, so this is a local signature
            # check, not a round-trip to Cognito.
            return f"user:{decode_cognito_token(token).sub}"
        except UnauthorizedError:
            pass
    host = request.client.host if request.client else "unknown"
    if email:
        return f"ip:{host}|email:{email.strip().lower()}"
    return f"ip:{host}"


def rate_limit(
    limit: int, window_seconds: float, *, name: str
) -> Callable[[Request], Awaitable[None]]:
    limiter = RateLimiter(limit, window_seconds, name=name)

    async def dependency(request: Request) -> None:
        limiter.check(request)

    dependency.__name__ = f"rate_limit_{name}"
    return dependency


rate_limit_default = rate_limit(
    settings.THROTTLE_GENERAL_LIMIT, settings.throttle_window_seconds, name="general"
)
