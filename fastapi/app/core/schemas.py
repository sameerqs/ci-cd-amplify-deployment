import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, StringConstraints
from pydantic.alias_generators import to_camel


class InputSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class OutputSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        serialize_by_alias=True,
        validate_by_name=True,
        validate_by_alias=True,
        from_attributes=True,
    )


PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
)
PASSWORD_RULE = (
    "Password must be at least 8 characters and contain uppercase, lowercase, "  # noqa: S105
    "number, and special character (@$!%*?&)"
)
PHONE_PATTERN = re.compile(r"^(\+?1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$")
PHONE_RULE = "Please enter a valid US phone number (e.g., (555) 555-1212)"
POSTAL_PATTERN = r"^\d{5}(-\d{4})?$"


def _check_password(value: str) -> str:
    if PASSWORD_PATTERN.match(value) is None:
        raise ValueError(PASSWORD_RULE)
    return value


def _check_phone(value: str) -> str:
    if PHONE_PATTERN.match(value) is None:
        raise ValueError(PHONE_RULE)
    return value


PasswordStr = Annotated[
    str, StringConstraints(min_length=8, max_length=100), AfterValidator(_check_password)
]
EmailLower = Annotated[EmailStr, StringConstraints(max_length=100), AfterValidator(str.lower)]
PhoneStr = Annotated[
    str, StringConstraints(min_length=1, max_length=32), AfterValidator(_check_phone)
]
PostalStr = Annotated[str, StringConstraints(min_length=1, max_length=10, pattern=POSTAL_PATTERN)]
