import os
from collections.abc import Iterator

import pytest
from dotenv import load_dotenv

# why: must be set before `app.core.config` is imported anywhere -- it is what
# stops Settings() from reading the developer's real fastapi/.env off disk (see
# the comment on _SKIP_DOTENV there). load_dotenv() below still runs, so
# TEST_DATABASE_URL is read from the real file as intended; this only stops
# pydantic-settings' own, separate file read.
os.environ["PET2TEXT_SKIP_DOTENV"] = "1"

load_dotenv(".env")
os.environ["ENV"] = "test"
os.environ["LOG_JSON"] = "false"
os.environ.setdefault("PEPPER_SECRET", "test-pepper-secret-0123456789-0123456789-abc")
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://unset:unset@127.0.0.1:1/unset"
)
# Belt and suspenders: PET2TEXT_SKIP_DOTENV already stops the file read: this
# additionally scrubs anything load_dotenv() put in os.environ, so a stray
# `Settings()` built without going through model_validate/monkeypatch still
# cannot see a real credential.
for _env_name in (
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "COGNITO_USER_POOL_ID",
    "COGNITO_CLIENT_ID",
    "ENABLE_EMAIL",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USER",
    "EMAIL_PASS",
    "EMAIL_FROM",
    # why: missing here, this one reached Settings through os.environ and made
    # test_llm_disabled_without_key fail the moment a developer put a real key
    # in .env -- and left any test that builds a live ChatOpenAI one step from
    # spending their credit.
    "OPENAI_API_KEY",
):
    os.environ.pop(_env_name, None)


@pytest.fixture(autouse=True)
def _reset_limiters() -> Iterator[None]:
    from app.core.rate_limit import reset_all_limiters

    reset_all_limiters()
    yield
    reset_all_limiters()
