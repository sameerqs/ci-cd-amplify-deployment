import os
import re
from datetime import timedelta
from typing import Annotated, Literal, Self
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

MIN_SECRET_LENGTH = 32
# why: pydantic-settings reads env_file directly off disk on every Settings()
# construction, independent of and in addition to os.environ -- so a test that
# builds its own Settings (there are several) picks up the developer's real
# fastapi/.env regardless of anything cleared from os.environ. That is not
# hypothetical: with real AWS/Cognito/SMTP credentials in .env, a test run has
# made live calls to Cognito and sent live email. tests/conftest.py sets this
# before importing anything of ours, so the file is never opened in a test
# process. The one test that needs real dotenv-loading semantics (proving
# .env.example alone boots the app) passes _env_file explicitly instead.
_SKIP_DOTENV = os.environ.get("PET2TEXT_SKIP_DOTENV") == "1"
_DURATION_RE = re.compile(r"^\s*(\d+)\s*(ms|s|m|h|d)\s*$")
_DURATION_UNITS = {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0, "d": 86400.0}

Env = Literal["development", "test", "uat", "production"]


def parse_duration(value: str) -> timedelta:
    match = _DURATION_RE.match(value)
    if match is None:
        raise ValueError(f"invalid duration {value!r}; expected e.g. '15m', '7d', '30s'")
    amount, unit = match.groups()
    return timedelta(seconds=int(amount) * _DURATION_UNITS[unit])


def _split_csv(value: object) -> object:
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None if _SKIP_DOTENV else ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    ENV: Env = "development"
    APP_NAME: str = "Pet2text"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # why: this is the ceiling on every request, chat attachments included --
    # ATTACHMENT_MAX_BYTES alone does nothing if the body never gets that far.
    # Sized for one attachment at the cap plus multipart overhead; several
    # large files in the same turn can still exceed it.
    BODY_LIMIT_BYTES: int = Field(default=55 * 1024 * 1024, ge=1024)

    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = Field(default=20, ge=1)
    DATABASE_POOL_MAX_OVERFLOW: int = Field(default=10, ge=0)
    DATABASE_POOL_TIMEOUT_SECONDS: int = Field(default=10, ge=1)
    DATABASE_POOL_RECYCLE_SECONDS: int = Field(default=1800, ge=1)

    # How long a signed-in device stays signed in. Keep it at or under the app
    # client's refresh-token validity in Cognito: the pool stops honouring the
    # refresh token first otherwise, and the session dies with no explanation.
    SESSION_EXPIRES_IN: str = "30d"

    PEPPER_SECRET: SecretStr
    # Encrypts the Cognito refresh token held in auth_sessions. Optional:
    # when unset the vault derives its own key from PEPPER_SECRET, so a
    # deployment has one fewer secret to manage. Set it to rotate the
    # vault without touching password hashing. Must be a Fernet key
    # (urlsafe base64 of 32 bytes).
    SESSION_ENCRYPTION_KEY: SecretStr | None = None
    MAGIC_LINK_TOKEN_TTL_SECONDS: int = Field(default=900, ge=60)

    # Attachment storage. With a bucket configured the app uses S3; without one
    # it falls back to a local directory so dev and CI need no cloud account.
    # Region and credentials fall back to the AWS_* values above; set these only
    # when the bucket lives somewhere else or under a different identity.
    S3_BUCKET: str | None = Field(
        default=None,
        validation_alias=AliasChoices("S3_BUCKET", "AWS_S3_BUCKET_NAME"),
    )
    S3_REGION: str | None = None
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: SecretStr | None = None
    LOCAL_STORAGE_DIR: str = "var/attachments"
    ATTACHMENT_MAX_BYTES: int = Field(default=50 * 1024 * 1024, ge=1024)

    # Set on the refresh-token cookie this API writes. A Secure cookie is
    # dropped silently by the browser over plain HTTP, so local development
    # against http://localhost has to be able to turn it off.
    COOKIE_SECURE: bool = True
    # AWS. One region for the account, and one identity. Leave the keys blank
    # in AWS itself and let the instance role supply them; boto3 only receives
    # them when they are set here.
    AWS_REGION: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: SecretStr | None = None

    # The pool, and the one app client this backend signs in through. There is
    # no second public client: the browser never talks to Cognito directly. The
    # client is configured without a secret -- nothing here computes a
    # SECRET_HASH, so giving the app client one would make every auth call fail.
    COGNITO_USER_POOL_ID: str | None = None
    COGNITO_CLIENT_ID: str | None = None

    THROTTLE_GENERAL_TTL: int = Field(default=60_000, ge=1000)
    THROTTLE_GENERAL_LIMIT: int = Field(default=100, ge=1)

    ENABLE_EMAIL: bool = False
    EMAIL_HOST: str | None = None
    EMAIL_PORT: int = 587
    EMAIL_USER: str | None = None
    EMAIL_PASS: SecretStr | None = None
    EMAIL_FROM: str = "Pet2text <no-reply@example.com>"

    SEED_ADMIN_EMAIL: str | None = None

    OPENAI_API_KEY: SecretStr | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TEMPERATURE: float = Field(default=0.2, ge=0.0, le=2.0)
    OPENAI_TIMEOUT_SECONDS: float = Field(default=60.0, gt=0)
    OPENAI_MAX_RETRIES: int = Field(default=2, ge=0)

    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool | None = None

    @field_validator("PEPPER_SECRET")
    @classmethod
    def _secret_length(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < MIN_SECRET_LENGTH:
            raise ValueError(f"must be at least {MIN_SECRET_LENGTH} characters")
        return value

    @field_validator("DATABASE_URL")
    @classmethod
    def _asyncpg_url(cls, value: str) -> str:
        parts = urlsplit(value)
        if parts.scheme not in ("postgresql+asyncpg", "postgresql", "postgres"):
            raise ValueError("must be a postgresql:// URL")
        # why: Prisma's ?schema=public would be forwarded to asyncpg.connect(), which rejects it
        query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "schema"]
        return urlunsplit(parts._replace(scheme="postgresql+asyncpg", query=urlencode(query)))

    @field_validator("SESSION_EXPIRES_IN")
    @classmethod
    def _duration(cls, value: str) -> str:
        parse_duration(value)
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _cors_csv(cls, value: object) -> object:
        return _split_csv(value)

    @model_validator(mode="after")
    def _cognito_required_in_production(self) -> Self:
        # why: Cognito is the only way in, so a production process with a
        # half-configured pool can serve nothing but 503s -- fail at startup
        # instead. Development and CI stay runnable without an AWS account.
        if self.ENV == "production" and not self.cognito_configured:
            raise ValueError(
                "production requires AWS_REGION, COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID"
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def docs_enabled(self) -> bool:
        return not self.is_production

    @property
    def expose_error_details(self) -> bool:
        return self.ENV == "development"

    @property
    def session_ttl(self) -> timedelta:
        return parse_duration(self.SESSION_EXPIRES_IN)

    @property
    def throttle_window_seconds(self) -> float:
        return self.THROTTLE_GENERAL_TTL / 1000

    @property
    def log_json(self) -> bool:
        if self.LOG_JSON is not None:
            return self.LOG_JSON
        return self.ENV in ("uat", "production")

    @property
    def cognito_configured(self) -> bool:
        return bool(self.AWS_REGION and self.COGNITO_USER_POOL_ID and self.COGNITO_CLIENT_ID)

    @property
    def cognito_issuer(self) -> str:
        return f"https://cognito-idp.{self.AWS_REGION}.amazonaws.com/{self.COGNITO_USER_POOL_ID}"

    @property
    def cognito_jwks_url(self) -> str:
        return f"{self.cognito_issuer}/.well-known/jwks.json"

    @property
    def cognito_client_ids(self) -> frozenset[str]:
        """The app clients a token may be minted for. One today; a set because
        audience validation is the check, and a second client must not mean
        editing the verifier."""
        return frozenset({self.COGNITO_CLIENT_ID}) if self.COGNITO_CLIENT_ID else frozenset()

    @property
    def s3_region(self) -> str:
        return self.S3_REGION or self.AWS_REGION or "us-east-1"

    @property
    def s3_access_key_id(self) -> str | None:
        return self.S3_ACCESS_KEY_ID or self.AWS_ACCESS_KEY_ID

    @property
    def s3_secret_access_key(self) -> str | None:
        secret = self.S3_SECRET_ACCESS_KEY or self.AWS_SECRET_ACCESS_KEY
        return secret.get_secret_value() if secret else None

    @property
    def aws_secret_access_key(self) -> str | None:
        secret = self.AWS_SECRET_ACCESS_KEY
        return secret.get_secret_value() if secret else None

    @property
    def llm_enabled(self) -> bool:
        return self.OPENAI_API_KEY is not None

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.FRONTEND_URL, *self.CORS_ORIGINS]
        if not self.is_production:
            origins += ["http://localhost:3000", "http://127.0.0.1:3000"]
        return list(dict.fromkeys(origins))


settings = Settings()  # type: ignore[call-arg]
