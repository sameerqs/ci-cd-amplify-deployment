import pytest
from pydantic import TypeAdapter, ValidationError

from app.core.schemas import (
    PASSWORD_RULE,
    EmailLower,
    InputSchema,
    OutputSchema,
    PasswordStr,
    PhoneStr,
    PostalStr,
)


class Payload(InputSchema):
    first_name: str
    last_name: str | None = None


class Out(OutputSchema):
    first_name: str


@pytest.mark.parametrize("value", ["Abcdef1!", "Str0ng&Password", "aA1@aA1@"])
def test_password_accepts_policy(value: str) -> None:
    assert TypeAdapter(PasswordStr).validate_python(value) == value


@pytest.mark.parametrize(
    "value", ["short1!", "alllowercase1!", "ALLUPPER1!", "NoDigits!!", "NoSpecial1a"]
)
def test_password_rejects_policy(value: str) -> None:
    with pytest.raises(ValidationError) as excinfo:
        TypeAdapter(PasswordStr).validate_python(value)
    text = str(excinfo.value)
    assert PASSWORD_RULE in text or "at least 8" in text


def test_email_lowercased_and_bounded() -> None:
    assert TypeAdapter(EmailLower).validate_python("Foo@Example.COM") == "foo@example.com"
    with pytest.raises(ValidationError):
        TypeAdapter(EmailLower).validate_python("not-an-email")


def test_phone_and_postal() -> None:
    assert TypeAdapter(PhoneStr).validate_python("(555) 555-1212") == "(555) 555-1212"
    with pytest.raises(ValidationError, match="US phone"):
        TypeAdapter(PhoneStr).validate_python("12")
    assert TypeAdapter(PostalStr).validate_python("12345-6789") == "12345-6789"
    with pytest.raises(ValidationError):
        TypeAdapter(PostalStr).validate_python("ABCDE")


def test_input_schema_is_strict_and_trims() -> None:
    parsed = Payload.model_validate({"firstName": "  Ada ", "last_name": "Lovelace"})
    assert parsed.first_name == "Ada"
    assert parsed.last_name == "Lovelace"
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        Payload.model_validate({"firstName": "Ada", "role": 0})


def test_output_schema_serialises_camel_from_attributes() -> None:
    class Row:
        first_name = "Ada"

    assert Out.model_validate(Row()).model_dump() == {"firstName": "Ada"}
