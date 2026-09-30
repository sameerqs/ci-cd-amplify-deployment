import os
import subprocess
import sys
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import settings
from app.core.enums import UserStatus
from app.db.session import engine as app_engine
from app.db.session import get_session
from app.main import app
from app.modules.cognito import passwordless
from app.modules.users.models import User
from tests.api.role_compat import UserRole

if TYPE_CHECKING:
    from tests.api.cognito_fake import FakePool

ROOT = Path(__file__).resolve().parents[2]

# The pool is faked, but the tokens are real: signed with a throwaway RSA key so
# every request in this suite goes through the same JWKS verification path
# production uses. Nothing here short-circuits get_current_user.
RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PRIVATE_PEM = RSA_KEY.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
AWS_REGION = "us-east-1"
COGNITO_POOL_ID = "us-east-1_testpool"
COGNITO_CLIENT_ID = "test-client"
COGNITO_ISSUER = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_POOL_ID}"


class _SigningKey:
    def __init__(self) -> None:
        self.key = RSA_KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, token: str) -> _SigningKey:
        return _SigningKey()


def cognito_access_token(*, sub: str, email: str | None = None, expires_in: int = 900) -> str:
    """A pool access token. No `email` claim unless asked -- a real one has none."""
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": sub,
        "username": sub,
        "token_use": "access",
        "client_id": COGNITO_CLIENT_ID,
        "iss": COGNITO_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, PRIVATE_PEM, algorithm="RS256")


@pytest.fixture(autouse=True)
def cognito_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cognito is the only way in, so every API test runs with a pool behind it."""
    monkeypatch.setattr(settings, "AWS_REGION", AWS_REGION)
    monkeypatch.setattr(settings, "COGNITO_USER_POOL_ID", COGNITO_POOL_ID)
    monkeypatch.setattr(settings, "COGNITO_CLIENT_ID", COGNITO_CLIENT_ID)
    monkeypatch.setattr("app.core.cognito_jwt._jwks_client", lambda url: _FakeJwks())
    # why: the test transport speaks http, and a Secure cookie is withheld over
    # http by any correct client -- the session cookie would be set and never
    # sent back. This mirrors local development on http://localhost.
    monkeypatch.setattr(settings, "COOKIE_SECURE", False)


@pytest.fixture(scope="session")
def migrated_db() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        raise RuntimeError(
            "TEST_DATABASE_URL is required for API tests (set it in .env or the shell)"
        )
    env = {**os.environ, "DATABASE_URL": url}
    for args in (["downgrade", "base"], ["upgrade", "head"]):
        subprocess.run(  # noqa: S603
            [sys.executable, "-m", "alembic", *args], check=True, env=env, cwd=ROOT
        )
    return url


@pytest.fixture(scope="session")
async def engine(migrated_db: str) -> AsyncIterator[AsyncEngine]:
    yield app_engine
    await app_engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with engine.connect() as connection:
        await connection.begin()
        test_session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield test_session
        finally:
            await test_session.close()
            await connection.rollback()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.clear()


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    role: UserRole | None = None,
    status: UserStatus = UserStatus.ACTIVE,
    cognito_sub: str | None = None,
    linked: bool = True,
    created_by_id: UUID | None = None,
) -> User:
    """A user row. `linked=False` is someone the pool has never vouched for yet,
    which is what a first sign-in looks like."""
    if cognito_sub is None and linked:
        cognito_sub = f"sub-{uuid4()}"
    user = User(
        email=email,
        is_super_admin=role is UserRole.SUPER_ADMIN,
        status=status,
        cognito_sub=cognito_sub,
        created_by_id=created_by_id,
        updated_by_id=created_by_id,
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    assert user.cognito_sub is not None
    return {"Authorization": f"Bearer {cognito_access_token(sub=user.cognito_sub)}"}


@pytest.fixture
async def roles(session: AsyncSession) -> None:
    return None


@pytest.fixture
async def super_admin(session: AsyncSession, roles: None) -> User:
    return await create_user(session, email="root@example.com", role=UserRole.SUPER_ADMIN)


@pytest.fixture
async def admin_user(session: AsyncSession, roles: None) -> User:
    return await create_user(session, email="admin@example.com", role=UserRole.ADMIN)


@pytest.fixture
async def plain_user(session: AsyncSession, roles: None) -> User:
    return await create_user(session, email="user@example.com", role=UserRole.USER)


@pytest.fixture
def super_admin_headers(super_admin: User) -> dict[str, str]:
    return auth_headers(super_admin)


@pytest.fixture
async def admin_headers(session: AsyncSession) -> dict[str, str]:
    user = await session.scalar(select(User).where(User.is_super_admin.is_(True)))
    if user is None:
        user = await create_user(session, email="root@example.com", role=UserRole.SUPER_ADMIN)
    if user.cognito_sub is None:
        # why: a Super Admin the seed created has never signed in, so nothing
        # has bound a pool identity to it. Calling the API as that user needs
        # one -- without this the fixture found the seeded row and asserted.
        user.cognito_sub = f"sub-{uuid4()}"
        await session.flush()
    return auth_headers(user)


@pytest.fixture
def user_headers(plain_user: User) -> dict[str, str]:
    return auth_headers(plain_user)


@pytest.fixture
def pool(monkeypatch: pytest.MonkeyPatch) -> "FakePool":
    """A fake user pool wired into every place that reaches for a CognitoClient."""
    from tests.api.cognito_fake import FakePool

    fake = FakePool()
    monkeypatch.setattr("app.modules.cognito.passwordless.CognitoClient", lambda *a, **k: fake)
    monkeypatch.setattr("app.modules.cognito.provisioning.CognitoClient", lambda *a, **k: fake)
    monkeypatch.setattr("app.modules.cognito.session.CognitoClient", lambda *a, **k: fake)

    async def fake_send(*args: Any, **kwargs: Any) -> bool:
        return True

    monkeypatch.setattr(passwordless, "send_email", fake_send)
    return fake
