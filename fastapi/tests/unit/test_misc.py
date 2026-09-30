import smtplib
import tomllib
from datetime import UTC
from pathlib import Path
from types import TracebackType
from typing import ClassVar, Self

import pytest

import app
from app.core import mailer
from app.core.config import settings
from app.core.enums import (
    GENDER_LABELS,
    SPECIES_LABELS,
    Gender,
    Species,
)
from app.core.utils import format_person_name, utc_now


def test_version_matches_pyproject() -> None:
    pyproject = tomllib.loads((Path(__file__).resolve().parents[2] / "pyproject.toml").read_text())
    assert app.__version__ == pyproject["project"]["version"]


def test_enum_labels_are_complete() -> None:
    assert set(SPECIES_LABELS) == set(Species)
    assert set(GENDER_LABELS) == set(Gender)


def test_format_person_name_and_utc_now() -> None:
    assert format_person_name("Ada", "Lovelace", "x") == "Ada Lovelace"
    assert format_person_name(" Ada ", None, "x") == "Ada"
    assert format_person_name(None, "", "ada@example.com") == "ada@example.com"
    assert utc_now().tzinfo is UTC


class FakeSMTP:
    sent: ClassVar[list[tuple[str, str, str]]] = []
    fail: ClassVar[bool] = False

    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.host, self.port = host, port
        self.tls = False
        self.login_args: tuple[str, str] | None = None

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        return None

    def starttls(self) -> None:
        self.tls = True

    def login(self, user: str, password: str) -> None:
        self.login_args = (user, password)

    def send_message(self, message: object) -> None:
        if FakeSMTP.fail:
            raise smtplib.SMTPException("nope")
        FakeSMTP.sent.append((str(message["To"]), str(message["Subject"]), self.host))  # type: ignore[index]


async def test_send_email_skips_when_email_is_disabled(caplog: pytest.LogCaptureFixture) -> None:
    settings.ENABLE_EMAIL = False
    settings.EMAIL_HOST = None
    assert await mailer.send_email("to@example.com", "Hi", "welcome.html") is False
    assert "Email is disabled or EMAIL_HOST is not configured" in caplog.text


async def test_send_email_success_and_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ENABLE_EMAIL", True)
    monkeypatch.setattr(settings, "EMAIL_HOST", "smtp.test")
    monkeypatch.setattr(settings, "EMAIL_USER", "u")
    monkeypatch.setattr(settings, "EMAIL_PASS", type(settings.PEPPER_SECRET)("p"))
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    FakeSMTP.sent.clear()
    FakeSMTP.fail = False
    sent = await mailer.send_email(
        "to@example.com",
        "Welcome",
        "welcome.html",
        display_name="Ada",
        email="to@example.com",
        login_url="http://localhost:3000/login",
    )
    assert sent is True
    assert FakeSMTP.sent == [("to@example.com", "Welcome", "smtp.test")]
    FakeSMTP.fail = True
    assert (
        await mailer.send_email(
            "to@example.com",
            "Welcome",
            "welcome.html",
            display_name="A",
            email="e",
            login_url="u",
        )
        is False
    )


def test_render_template_escapes_html() -> None:
    html = mailer.render_template("welcome.html", display_name="<b>x</b>", email="e", login_url="u")
    assert "&lt;b&gt;x&lt;/b&gt;" in html
    assert settings.APP_NAME in html


def test_models_registry_lists_every_table() -> None:
    from app.db import models
    from app.db.base import Base

    assert set(models.__all__) == {
        "Attachment",
        "CapturedEntry",
        "Category",
        "ChatMessage",
        "Conversation",
        "MagicLinkToken",
        "Pet",
        "AuthSession",
        "RoadmapItem",
        "RoadmapVote",
        "SignupRequest",
        "User",
    }
    assert set(Base.metadata.tables) == {
        "attachments",
        "captured_entries",
        "categories",
        "chat_messages",
        "conversations",
        "magic_link_tokens",
        "pets",
        "auth_sessions",
        "roadmap_items",
        "roadmap_votes",
        "signup_requests",
        "users",
    }
