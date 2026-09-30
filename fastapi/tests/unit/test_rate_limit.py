import pytest
from fastapi import Request

from app.core.errors import RateLimitedError
from app.core.rate_limit import (
    RateLimiter,
    rate_limit,
    reset_all_limiters,
    tracker_key,
)


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def make_request(
    *, authorization: str | None = None, client: tuple[str, int] | None = ("1.2.3.4", 1234)
) -> Request:
    headers = [(b"authorization", authorization.encode())] if authorization else []
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": headers,
        "client": client,
        "query_string": b"",
    }
    return Request(scope)


def test_limiter_enforces_window_and_reports_retry_after() -> None:
    clock = Clock()
    limiter = RateLimiter(3, 60, name="t", now=clock)
    assert [limiter.hit("k") for _ in range(3)] == [None, None, None]
    clock.now += 10
    assert limiter.hit("k") == 50
    clock.now += 50
    assert limiter.hit("k") is None


def test_limiter_keys_are_independent_and_reset() -> None:
    limiter = RateLimiter(1, 60, name="t")
    assert limiter.hit("a") is None
    assert limiter.hit("b") is None
    assert limiter.hit("a") is not None
    reset_all_limiters()
    assert limiter.hit("a") is None


def test_limiter_prunes_when_full() -> None:
    clock = Clock()
    limiter = RateLimiter(5, 60, name="t", now=clock, max_keys=4)
    for key in "abcd":
        limiter.hit(key)
    clock.now += 61
    limiter.hit("e")
    assert set(limiter._buckets) == {"e"}
    for key in "fgh":
        limiter.hit(key)
    limiter.hit("i")
    assert len(limiter._buckets) <= 4


def test_tracker_key_prefers_user_then_ip_with_email_then_ip() -> None:
    # why: an unverifiable bearer token falls back to the address rather than
    # being trusted for its `sub` -- otherwise a forged token would let anyone
    # exhaust a chosen victim's bucket.
    assert (
        tracker_key(make_request(authorization="Bearer garbage"), " Ada@Example.com ")
        == "ip:1.2.3.4|email:ada@example.com"
    )
    assert (
        tracker_key(make_request(client=("10.0.0.2", 1234)), "ada@example.com")
        == "ip:10.0.0.2|email:ada@example.com"
    )
    assert (
        tracker_key(make_request(client=None), "ada@example.com")
        == "ip:unknown|email:ada@example.com"
    )
    assert tracker_key(make_request()) == "ip:1.2.3.4"
    assert tracker_key(make_request(client=None)) == "ip:unknown"


def test_check_raises_rate_limited_with_header() -> None:
    limiter = RateLimiter(1, 60, name="t")
    limiter.check(make_request())
    with pytest.raises(RateLimitedError) as excinfo:
        limiter.check(make_request())
    assert excinfo.value.headers["Retry-After"] == str(excinfo.value.retry_after)
    assert "Too many requests" in excinfo.value.message


async def test_rate_limit_dependency() -> None:
    dependency = rate_limit(1, 60, name="dep")
    assert dependency.__name__ == "rate_limit_dep"
    await dependency(make_request())
    with pytest.raises(RateLimitedError):
        await dependency(make_request())
