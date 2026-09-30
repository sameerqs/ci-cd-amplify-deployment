import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import anyio
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

logger = logging.getLogger("app.mailer")
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=select_autoescape(["html"]))


def render_template(template: str, **context: Any) -> str:
    return _env.get_template(template).render(app_name=settings.APP_NAME, **context)


def _send_sync(to: str, subject: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client.")
    message.add_alternative(html, subtype="html")
    host = settings.EMAIL_HOST or ""
    with smtplib.SMTP(host, settings.EMAIL_PORT, timeout=30) as client:
        client.starttls()
        if settings.EMAIL_USER and settings.EMAIL_PASS:
            client.login(settings.EMAIL_USER, settings.EMAIL_PASS.get_secret_value())
        client.send_message(message)


async def send_email(to: str, subject: str, template: str, **context: Any) -> bool:
    if not settings.ENABLE_EMAIL or not settings.EMAIL_HOST:
        logger.warning(
            "Email is disabled or EMAIL_HOST is not configured; skipping email %r", subject
        )
        return False
    html = render_template(template, **context)
    try:
        await anyio.to_thread.run_sync(_send_sync, to, subject, html)
    except (OSError, smtplib.SMTPException):
        logger.exception("Failed to send email %r", subject)
        return False
    return True
