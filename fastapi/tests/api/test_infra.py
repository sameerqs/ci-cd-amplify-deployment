from collections.abc import AsyncIterator
from typing import Any

import pytest
from fastapi.routing import APIRoute, iter_route_contexts
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.core.config import settings
from app.core.constants import ACCOUNT_NOT_APPROVED, API_V1_PREFIX, PUBLIC_PATHS
from app.core.deps import get_current_user
from app.core.enums import UserStatus
from app.main import app
from app.modules.users.models import User
from tests.api.conftest import auth_headers


async def test_health_returns_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["isSuccess"] is True
    assert body["data"] == {"status": "ok", "database": "up"}
    assert body["errors"] == []
    assert "x-request-id" in response.headers


async def test_health_reports_database_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def broken(*args: Any, **kwargs: Any) -> None:
        raise ConnectionError("db down")

    monkeypatch.setattr(AsyncSession, "execute", broken)
    response = await client.get("/api/health")
    assert response.status_code == 503
    body = response.json()
    assert body["isSuccess"] is False
    assert body["errors"][0]["code"] == "SERVICE_UNAVAILABLE"


async def test_version(client: AsyncClient) -> None:
    body = (await client.get("/api/version")).json()
    assert body["data"]["apiVersion"] == __version__
    assert body["data"]["apiMajor"] == __version__.split(".")[0]
    assert body["data"]["environment"] == "test"
    assert body["data"]["timestamp"].endswith("Z") or "+00:00" in body["data"]["timestamp"]


async def test_lifespan_verifies_database(migrated_db: str) -> None:
    async with app.router.lifespan_context(app):
        pass


async def test_unknown_route_and_method_are_enveloped(client: AsyncClient) -> None:
    missing = await client.get("/api/v1/nope")
    assert missing.status_code == 404
    assert missing.json()["errors"][0]["code"] == "NOT_FOUND"
    wrong_method = await client.delete("/api/health")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["isSuccess"] is False


async def test_validation_error_envelope_with_field_paths(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/magic-link", json={"email": "nope", "extra": 1})
    assert response.status_code == 422
    body = response.json()
    assert body["isSuccess"] is False
    fields = {error["field"] for error in body["errors"]}
    assert {"email", "extra"} <= fields
    assert all(error["code"] == "UNPROCESSABLE_ENTITY" for error in body["errors"])
    assert body["message"] == body["errors"][0]["message"]
    assert body["data"]["statusCode"] == 422


async def test_missing_and_invalid_tokens(client: AsyncClient) -> None:
    missing = await client.get("/api/v1/users/profile")
    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert missing.json()["errors"][0]["code"] == "UNAUTHORIZED"
    invalid = await client.get("/api/v1/users/profile", headers={"Authorization": "Bearer nope"})
    assert invalid.status_code == 401
    basic = await client.get("/api/v1/users/profile", headers={"Authorization": "Basic abc"})
    assert basic.status_code == 401


async def test_a_deactivated_users_token_is_refused_with_the_reason(
    client: AsyncClient, plain_user: User, session: AsyncSession
) -> None:
    headers = auth_headers(plain_user)
    plain_user.status = UserStatus.REJECTED
    await session.flush()
    res = await client.get("/api/v1/users/profile", headers=headers)
    assert res.status_code == 403
    assert res.json()["errors"][0]["code"] == ACCOUNT_NOT_APPROVED


async def test_openapi_documents_envelope_and_flat_bodies(client: AsyncClient) -> None:
    spec = (await client.get("/openapi.json")).json()
    assert spec["info"]["version"] == __version__
    assert "access-token" in spec["components"]["securitySchemes"]
    for path in ("/auth/magic-link", "/auth/magic-link/verify"):
        operation = spec["paths"][f"{API_V1_PREFIX}{path}"]["post"]
        schema = operation["requestBody"]["content"]["application/json"]["schema"]
        assert set(schema) == {"$ref"}, f"{path} body is not a flat schema reference"
        assert "422" in operation["responses"]
    verify_ok = spec["paths"][f"{API_V1_PREFIX}/auth/magic-link/verify"]["post"]["responses"]["200"]
    assert verify_ok["content"]["application/json"]["schema"]["$ref"].endswith(
        "ApiResponse_MagicLinkSessionOut_"
    )
    assert "ApiResponse_UserOut_" in spec["components"]["schemas"]
    assert "ApiResponse_UsersPage_" in spec["components"]["schemas"]
    docs = await client.get("/docs")
    assert docs.status_code == 200


def test_every_v1_route_is_protected_unless_public() -> None:
    checked = 0
    for context in iter_route_contexts(app.routes):
        path = context.path or ""
        if not isinstance(context.route, APIRoute) or not path.startswith(API_V1_PREFIX):
            continue
        dependencies = {dep.dependency for dep in context.dependencies} | {
            dep.call for dep in context.route.dependant.dependencies
        }
        if path in PUBLIC_PATHS:
            assert get_current_user not in dependencies, path
            continue
        assert get_current_user in dependencies, path
        checked += 1
    assert checked >= 12


async def test_unhandled_crash_returns_envelope_with_cors(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom() -> None:
        raise RuntimeError("kaboom")

    monkeypatch.setattr("app.modules.version.router.utc_now", boom)
    response = await client.get("/api/version", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    body = response.json()
    assert body["isSuccess"] is False
    assert body["message"] == "Internal server error"
    assert body["errors"][0]["code"] == "INTERNAL_ERROR"


async def test_request_body_limit(client: AsyncClient) -> None:
    # why: sized off the real setting, not a hardcoded guess -- this used to
    # assert a fixed 2MB against the old 1MB default and went silently past the
    # point of proving anything once BODY_LIMIT_BYTES grew past it.
    payload = {"email": "a@b.co", "password": "x" * (settings.BODY_LIMIT_BYTES + 1)}
    response = await client.post("/api/v1/auth/magic-link", json=payload)
    assert response.status_code == 413
    assert response.json()["errors"][0]["code"] == "PAYLOAD_TOO_LARGE"


async def test_request_body_limit_without_content_length(client: AsyncClient) -> None:
    chunk = b"x" * 65_536

    async def stream() -> AsyncIterator[bytes]:
        for _ in range(settings.BODY_LIMIT_BYTES // len(chunk) + 2):
            yield chunk

    response = await client.post(
        "/api/v1/auth/magic-link", content=stream(), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert response.json()["errors"][0]["code"] == "PAYLOAD_TOO_LARGE"
