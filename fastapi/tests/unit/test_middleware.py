import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException
from starlette.types import Message, Scope

from app.core.body_limit import BodyLimitMiddleware
from app.core.catch_all import CatchAllMiddleware
from app.core.config import settings
from app.core.errors import install_exception_handlers
from app.core.logging import RequestContextMiddleware, request_id_var


def build_app() -> FastAPI:
    app = FastAPI()
    install_exception_handlers(app)

    @app.post("/echo")
    async def echo(payload: dict[str, str]) -> dict[str, str]:
        return payload

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("kaboom")

    @app.get("/rid")
    async def rid() -> dict[str, str]:
        return {"request_id": request_id_var.get()}

    app.add_middleware(BodyLimitMiddleware, max_bytes=64)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(CatchAllMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=["http://client.test"])
    return app


def test_body_limit_rejects_declared_oversized_body() -> None:
    client = TestClient(build_app())
    response = client.post("/echo", content=b'{"a":"' + b"x" * 100 + b'"}')
    assert response.status_code == 413
    body = response.json()
    assert body["isSuccess"] is False
    assert body["errors"][0]["code"] == "PAYLOAD_TOO_LARGE"
    assert body["data"]["statusCode"] == 413


def test_body_limit_allows_small_body() -> None:
    client = TestClient(build_app())
    assert client.post("/echo", json={"a": "b"}).json() == {"a": "b"}


async def test_body_limit_counts_streamed_chunks() -> None:
    received: list[bytes] = []

    async def app(scope: Scope, receive: object, send: object) -> None:
        while True:
            message = await receive()  # type: ignore[operator]
            received.append(message["body"])
            if not message.get("more_body"):
                break

    chunks = [
        {"type": "http.request", "body": b"x" * 40, "more_body": True},
        {"type": "http.request", "body": b"x" * 40, "more_body": False},
    ]

    async def receive() -> Message:
        return chunks.pop(0)

    async def send(message: Message) -> None:
        pass

    middleware = BodyLimitMiddleware(app, max_bytes=64)
    scope: Scope = {"type": "http", "path": "/", "headers": []}
    with pytest.raises(HTTPException) as raised:
        await middleware(scope, receive, send)
    assert raised.value.status_code == 413
    assert received == [b"x" * 40]


def test_catch_all_returns_envelope_with_cors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ENV", "production")
    client = TestClient(build_app(), raise_server_exceptions=False)
    response = client.get("/boom", headers={"Origin": "http://client.test"})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://client.test"
    body = response.json()
    assert body["message"] == "Internal server error"
    assert body["errors"][0]["code"] == "INTERNAL_ERROR"
    monkeypatch.setattr(settings, "ENV", "development")
    shown = client.get("/boom").json()
    assert shown["message"] == "RuntimeError: kaboom"


def test_request_context_sets_and_echoes_request_id() -> None:
    client = TestClient(build_app())
    echoed = client.get("/rid", headers={"X-Request-ID": "trace-42"})
    assert echoed.headers["x-request-id"] == "trace-42"
    assert echoed.json()["request_id"] == "trace-42"
    replaced = client.get("/rid", headers={"X-Request-ID": "bad value\n"})
    assert replaced.headers["x-request-id"] != "bad value\n"
    assert len(replaced.headers["x-request-id"]) == 32


def test_middlewares_pass_through_non_http_scopes() -> None:
    calls: list[str] = []

    async def app(scope: Scope, receive: object, send: object) -> None:
        calls.append(scope["type"])

    async def noop() -> Message:
        return {"type": "lifespan.startup"}

    async def send(message: Message) -> None:
        pass

    import asyncio

    scope: Scope = {"type": "lifespan"}
    asyncio.run(BodyLimitMiddleware(app, max_bytes=1)(scope, noop, send))
    asyncio.run(CatchAllMiddleware(app)(scope, noop, send))
    asyncio.run(RequestContextMiddleware(app)(scope, noop, send))
    assert calls == ["lifespan"] * 3
