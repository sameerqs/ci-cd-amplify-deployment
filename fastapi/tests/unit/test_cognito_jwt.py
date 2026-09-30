from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat

from app.core.cognito_jwt import (
    CognitoTokenClaims,
    decode_cognito_token,
)
from app.core.config import Settings
from app.core.errors import UnauthorizedError

RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PRIVATE_PEM = RSA_KEY.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool"
APP_CLIENT = "app-client"


def make_cognito_settings(**overrides: object) -> Settings:
    payload: dict[str, object] = {
        "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
        "PEPPER_SECRET": "y" * 32,
        "AWS_REGION": "us-east-1",
        "COGNITO_USER_POOL_ID": "us-east-1_pool",
        "COGNITO_CLIENT_ID": APP_CLIENT,
    }
    payload.update(overrides)
    return Settings.model_validate(payload)


class _Key:
    def __init__(self) -> None:
        self.key = RSA_KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, token: str) -> _Key:
        assert token
        return _Key()


def _cognito_payload(*, token_use: str, aud: str | None = APP_CLIENT) -> dict[str, Any]:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": "cognito-sub-1",
        "email": "ada@example.com",
        "iss": ISSUER,
        "token_use": token_use,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=15)).timestamp()),
        "cognito:username": "ada@example.com",
    }
    if token_use == "id":
        payload["aud"] = aud
    else:
        payload["client_id"] = aud or APP_CLIENT
        payload["username"] = "ada@example.com"
    return payload


def mint(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, PRIVATE_PEM, algorithm="RS256", headers={"kid": "test-kid"})


@pytest.fixture(autouse=True)
def _jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.cognito_jwt._jwks_client", lambda url: _FakeJwks())


def test_id_token_roundtrip() -> None:
    cfg = make_cognito_settings()
    token = mint(_cognito_payload(token_use="id"))
    claims = decode_cognito_token(token, cfg=cfg)
    assert isinstance(claims, CognitoTokenClaims)
    assert claims.login_email == "ada@example.com"
    assert claims.token_use == "id"


def test_access_token_client_id_checked() -> None:
    cfg = make_cognito_settings()
    token = mint(_cognito_payload(token_use="access", aud=APP_CLIENT))
    claims = decode_cognito_token(token, cfg=cfg)
    assert claims.token_use == "access"
    bad = mint(_cognito_payload(token_use="access", aud="other-client"))
    with pytest.raises(UnauthorizedError):
        decode_cognito_token(bad, cfg=cfg)


def test_wrong_audience_rejected() -> None:
    cfg = make_cognito_settings()
    token = mint(_cognito_payload(token_use="id", aud="nope"))
    with pytest.raises(UnauthorizedError):
        decode_cognito_token(token, cfg=cfg)


def test_unconfigured_cognito_rejected() -> None:
    cfg = Settings.model_validate(
        {
            "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
            "PEPPER_SECRET": "y" * 32,
        }
    )
    token = mint(_cognito_payload(token_use="id"))
    with pytest.raises(UnauthorizedError, match="not configured"):
        decode_cognito_token(token, cfg=cfg)
