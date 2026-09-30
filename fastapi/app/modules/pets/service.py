from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.pets.models import Pet
from app.modules.pets.schemas import CreatePetIn, PetOut, UpdatePetIn

NAME_TAKEN = "A pet with this name already exists."


def get_include_archived(
    include_archived: Annotated[bool, Query(alias="includeArchived")] = False,
) -> bool:
    return include_archived


IncludeArchivedDep = Annotated[bool, Depends(get_include_archived)]


async def list_pets(session: AsyncSession, owner_id: UUID, include_archived: bool) -> list[PetOut]:
    stmt = select(Pet).where(Pet.owner_id == owner_id, Pet.is_deleted.is_(False))
    if not include_archived:
        stmt = stmt.where(Pet.is_archived.is_(False))
    # why: archived pets sink to the bottom of the account list rather than
    # interleaving with the pets the owner is actively tracking.
    rows = (
        await session.execute(stmt.order_by(Pet.is_archived.asc(), Pet.created_at.asc()))
    ).scalars()
    return [PetOut.model_validate(row) for row in rows]


async def _load(session: AsyncSession, owner_id: UUID, pet_id: UUID) -> Pet:
    pet = await session.scalar(
        select(Pet).where(Pet.id == pet_id, Pet.owner_id == owner_id, Pet.is_deleted.is_(False))
    )
    if pet is None:
        raise NotFoundError("Pet not found")
    return pet


async def read_pet(session: AsyncSession, owner_id: UUID, pet_id: UUID) -> PetOut:
    return PetOut.model_validate(await _load(session, owner_id, pet_id))


async def _assert_name_free(
    session: AsyncSession, owner_id: UUID, name: str, exclude_id: UUID | None = None
) -> None:
    stmt = select(Pet.id).where(
        Pet.owner_id == owner_id,
        func.lower(Pet.name) == name.lower(),
        Pet.is_deleted.is_(False),
    )
    if exclude_id is not None:
        stmt = stmt.where(Pet.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise ConflictError(NAME_TAKEN)


async def _persist(session: AsyncSession, pet: Pet) -> None:
    try:
        await session.flush()
    except IntegrityError as exc:
        # why: the pre-check loses to a concurrent write; the partial unique
        # index is the real guard, so a race must still read as a conflict.
        await session.rollback()
        raise ConflictError(NAME_TAKEN) from exc
    await session.refresh(pet)
    await session.commit()


async def create_pet(session: AsyncSession, owner_id: UUID, payload: CreatePetIn) -> PetOut:
    await _assert_name_free(session, owner_id, payload.name)
    pet = Pet(
        owner_id=owner_id,
        name=payload.name,
        species=payload.species,
        age=payload.age,
        weight=payload.weight,
        breed=payload.breed,
        created_by_id=owner_id,
        updated_by_id=owner_id,
    )
    session.add(pet)
    await _persist(session, pet)
    return PetOut.model_validate(pet)


async def update_pet(
    session: AsyncSession, owner_id: UUID, pet_id: UUID, payload: UpdatePetIn
) -> PetOut:
    pet = await _load(session, owner_id, pet_id)
    changes = payload.model_dump(exclude_unset=True)
    name = changes.pop("name", None)
    if name is not None:
        await _assert_name_free(session, owner_id, name, exclude_id=pet.id)
        pet.name = name
    species = changes.pop("species", None)
    if species is not None:
        pet.species = species
    for field, value in changes.items():
        setattr(pet, field, value)
    pet.updated_by_id = owner_id
    await _persist(session, pet)
    return PetOut.model_validate(pet)


async def soft_delete_pet(session: AsyncSession, owner_id: UUID, pet_id: UUID) -> PetOut:
    pet = await _load(session, owner_id, pet_id)
    pet.is_deleted = True
    pet.is_archived = True
    pet.updated_by_id = owner_id
    await _persist(session, pet)
    return PetOut.model_validate(pet)
