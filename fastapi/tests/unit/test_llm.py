import pytest

from app.core import llm
from app.core.config import Settings, settings
from app.core.errors import ServiceUnavailableError

BASE: dict[str, object] = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "PEPPER_SECRET": "y" * 32,
}


@pytest.fixture(autouse=True)
def _clear_model_cache() -> None:
    llm.get_chat_model.cache_clear()


def test_llm_disabled_without_key() -> None:
    assert Settings.model_validate(BASE).llm_enabled is False


def test_llm_enabled_with_key() -> None:
    cfg = Settings.model_validate({**BASE, "OPENAI_API_KEY": "sk-test"})
    assert cfg.llm_enabled is True
    assert cfg.OPENAI_API_KEY is not None
    assert cfg.OPENAI_API_KEY.get_secret_value() == "sk-test"


def test_get_chat_model_without_key_is_service_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    with pytest.raises(ServiceUnavailableError):
        llm.get_chat_model()


def test_get_chat_model_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "OPENAI_API_KEY", SecretStr("sk-test"))
    monkeypatch.setattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
    model = llm.get_chat_model()
    assert model is llm.get_chat_model()
    assert model.model_name == "gpt-4o-mini"


def test_get_chat_model_pins_the_responses_api(monkeypatch: pytest.MonkeyPatch) -> None:
    """The transport is a decision, not whatever the model name implies.

    Unset, langchain-openai infers Chat Completions or Responses per call, so
    this would drift on an OPENAI_MODEL change alone.
    """
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "OPENAI_API_KEY", SecretStr("sk-test"))
    model = llm.get_chat_model()
    assert model.use_responses_api is True
    assert model.store is True
    payload = model._get_request_payload([("human", "hi")])
    assert "input" in payload
    assert "messages" not in payload
