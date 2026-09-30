from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BeforeValidator, StringConstraints

from app.core.enums import Species
from app.core.envelope import Items
from app.core.schemas import InputSchema, OutputSchema
from app.modules.pets.constants import (
    MAX_AGE_LENGTH,
    MAX_BREED_LENGTH,
    MAX_NAME_LENGTH,
    MAX_WEIGHT_LENGTH,
)


def _empty_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


Str20 = Annotated[str, StringConstraints(min_length=1, max_length=MAX_AGE_LENGTH)]
Str50 = Annotated[str, StringConstraints(min_length=1, max_length=MAX_NAME_LENGTH)]

PetName = Str50
OptionalAge = Annotated[Str20 | None, BeforeValidator(_empty_to_none)]
OptionalWeight = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=MAX_WEIGHT_LENGTH)] | None,
    BeforeValidator(_empty_to_none),
]
OptionalBreed = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=MAX_BREED_LENGTH)] | None,
    BeforeValidator(_empty_to_none),
]


class PetOut(OutputSchema):
    id: UUID
    name: str
    species: Species
    age: str | None
    weight: str | None
    breed: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime | None


class CreatePetIn(InputSchema):
    name: PetName
    species: Species
    age: OptionalAge = None
    weight: OptionalWeight = None
    breed: OptionalBreed = None


class UpdatePetIn(InputSchema):
    name: PetName | None = None
    species: Species | None = None
    age: OptionalAge = None
    weight: OptionalWeight = None
    breed: OptionalBreed = None
    is_archived: bool | None = None


PetItems = Items[PetOut]
