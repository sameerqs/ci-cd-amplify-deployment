from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.config import Settings, parse_duration, settings

ENV_EXAMPLE = Path(__file__).resolve().parents[2] / ".env.example"
BASE: dict[str, object] = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "PEPPER_SECRET": "y" * 32,
}
COGNITO: dict[str, object] = {
    "AWS_REGION": "us-east-1",
    "COGNITO_USER_POOL_ID": "us-east-1_pool",
    "COGNITO_CLIENT_ID": "app-client",
}


def make_settings(**overrides: object) -> Settings:
    # why: Settings.model_validate() does not accept the env-file-loading
    # controls, so building through the constructor is the only way to keep
    # a developer's real fastapi/.env from leaking into these tests -- it did,
    # silently making assertions like "Cognito is unconfigured by default"
    # pass or fail depending on whether that file happened to exist.
    payload: dict[str, Any] = {**BASE, **overrides}
    return Settings(_env_file=None, **payload)  # type: ignore[call-arg]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("15m", timedelta(minutes=15)),
        ("7d", timedelta(days=7)),
        ("30s", timedelta(seconds=30)),
        ("2h", timedelta(hours=2)),
        ("500ms", timedelta(milliseconds=500)),
        (" 1 d ", timedelta(days=1)),
    ],
)
def test_parse_duration(raw: str, expected: timedelta) -> None:
    assert parse_duration(raw) == expected


@pytest.mark.parametrize("raw", ["", "15", "m", "1w", "abc", "1.5h"])
def test_parse_duration_rejects_garbage(raw: str) -> None:
    with pytest.raises(ValueError, match="invalid duration"):
        parse_duration(raw)


def test_a_short_pepper_is_rejected() -> None:
    with pytest.raises(ValidationError) as excinfo:
        make_settings(PEPPER_SECRET="short")
    failing = {err["loc"][0] for err in excinfo.value.errors()}
    assert failing == {"PEPPER_SECRET"}


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgresql://u:p@localhost:5432/db", "postgresql+asyncpg://u:p@localhost:5432/db"),
        ("postgres://u:p@localhost:5432/db", "postgresql+asyncpg://u:p@localhost:5432/db"),
        (
            "postgresql+asyncpg://u:p@localhost:5432/db",
            "postgresql+asyncpg://u:p@localhost:5432/db",
        ),
        ("postgresql://u:p@db:5432/acme?schema=public", "postgresql+asyncpg://u:p@db:5432/acme"),
        (
            "postgresql://u:p@db:5432/acme?schema=public&ssl=require",
            "postgresql+asyncpg://u:p@db:5432/acme?ssl=require",
        ),
    ],
)
def test_database_url_is_normalised_to_asyncpg(raw: str, expected: str) -> None:
    url = make_settings(DATABASE_URL=raw).DATABASE_URL
    assert url == expected


def test_non_postgres_url_rejected() -> None:
    with pytest.raises(ValidationError, match="postgresql://"):
        make_settings(DATABASE_URL="mysql://x")


def test_bad_duration_rejected() -> None:
    with pytest.raises(ValidationError, match="invalid duration"):
        make_settings(SESSION_EXPIRES_IN="soon")


def test_cors_origins_csv_and_dedupe() -> None:
    cfg = make_settings(
        ENV="development",
        FRONTEND_URL="http://localhost:3000",
        CORS_ORIGINS="https://a.example, https://b.example ,",
    )
    assert cfg.CORS_ORIGINS == ["https://a.example", "https://b.example"]
    assert cfg.allowed_origins == [
        "http://localhost:3000",
        "https://a.example",
        "https://b.example",
        "http://127.0.0.1:3000",
    ]


def test_production_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOG_JSON", raising=False)
    cfg = make_settings(ENV="production", FRONTEND_URL="https://app.example", **COGNITO)
    assert cfg.is_production is True
    assert cfg.docs_enabled is False
    assert cfg.expose_error_details is False
    assert cfg.log_json is True
    assert cfg.allowed_origins == ["https://app.example"]


def test_log_json_override_and_ttls() -> None:
    cfg = make_settings(ENV="production", LOG_JSON=False, **COGNITO)
    assert cfg.log_json is False
    assert cfg.session_ttl == timedelta(days=30)
    assert cfg.throttle_window_seconds == 60.0


def test_empty_env_values_fall_back_to_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOG_JSON", "")
    monkeypatch.setenv("EMAIL_PASS", "")
    cfg = make_settings(ENV="production", **COGNITO)
    assert cfg.LOG_JSON is None
    assert cfg.log_json is True
    assert cfg.EMAIL_PASS is None


def test_env_example_boots_the_quick_start(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    example = ENV_EXAMPLE.read_text(encoding="utf-8")
    for line in example.splitlines():
        if line and not line.startswith("#"):
            monkeypatch.delenv(line.split("=", 1)[0], raising=False)
    required = [
        "DATABASE_URL=postgresql://u:p@localhost:5432/db",
        f"PEPPER_SECRET={'y' * 32}",
    ]
    env_path = tmp_path / ".env"
    env_path.write_text(example + "\n".join(required) + "\n", encoding="utf-8")
    # why: this is the one test that wants real dotenv-file semantics -- it is
    # proving .env.example alone is enough to boot -- so it points Settings at
    # its own throwaway file explicitly rather than relying on the class
    # default, which every other test in this suite runs with disabled.
    cfg = Settings(_env_file=env_path)  # type: ignore[call-arg]
    assert cfg.DATABASE_URL == "postgresql+asyncpg://u:p@localhost:5432/db"
    assert cfg.SEED_ADMIN_EMAIL is None
    assert cfg.EMAIL_HOST is None
    # The vault works with no key configured: it derives one from PEPPER_SECRET.
    assert cfg.SESSION_ENCRYPTION_KEY is None


def test_runtime_settings_are_test_env() -> None:
    assert settings.ENV == "test"


def test_cognito_is_optional_outside_production() -> None:
    # why: Cognito is the only way in, but development and CI must still be
    # able to boot the API without an AWS account behind it.
    cfg = make_settings(ENV="development")
    assert cfg.cognito_configured is False


def test_production_refuses_to_start_without_a_pool() -> None:
    with pytest.raises(ValidationError, match="AWS_REGION"):
        make_settings(ENV="production")


def test_a_configured_pool_derives_its_own_issuer_and_clients() -> None:
    cfg = make_settings(**COGNITO)
    assert cfg.cognito_configured is True
    assert cfg.cognito_issuer.endswith("/us-east-1_pool")
    assert cfg.COGNITO_CLIENT_ID == "app-client"
    assert "app-client" in cfg.cognito_client_ids


def test_the_request_body_ceiling_covers_one_full_size_attachment() -> None:
    # why: BodyLimitMiddleware runs ahead of every route, chat's own attachment
    # check included -- a smaller body ceiling than ATTACHMENT_MAX_BYTES makes
    # that check unreachable for any file near the limit. This is the guard
    # against the two drifting apart again the way they did once already.
    cfg = make_settings()
    assert cfg.BODY_LIMIT_BYTES > cfg.ATTACHMENT_MAX_BYTES
