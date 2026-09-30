from uuid import UUID

from fastapi import APIRouter

from app.core.deps import CurrentUser, SessionDep
from app.core.envelope import ApiResponse, Items, ok, ok_items
from app.modules.pets import service
from app.modules.pets.schemas import CreatePetIn, PetOut, UpdatePetIn
from app.modules.pets.service import IncludeArchivedDep

router = APIRouter(prefix="/pets", tags=["Pets"])
# why: pets belong to the owner, never to an admin - every route here is scoped
# to the caller's own id, so authentication is the gate and ownership is the filter.

PET_CREATED = "Pet added successfully"
PET_UPDATED = "Pet updated successfully"
PET_DELETED = "Pet removed successfully"


@router.get("", summary="List your pets")
async def list_pets(
    include_archived: IncludeArchivedDep, session: SessionDep, user: CurrentUser
) -> ApiResponse[Items[PetOut]]:
    return ok_items(await service.list_pets(session, user.id, include_archived))


@router.post("", summary="Add a pet")
async def create_pet(
    payload: CreatePetIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[PetOut]:
    return ok(await service.create_pet(session, user.id, payload), message=PET_CREATED)


@router.get("/{pet_id}", summary="Get one of your pets")
async def get_pet(pet_id: UUID, session: SessionDep, user: CurrentUser) -> ApiResponse[PetOut]:
    return ok(await service.read_pet(session, user.id, pet_id))


@router.patch("/{pet_id}", summary="Edit or archive a pet")
async def update_pet(
    pet_id: UUID, payload: UpdatePetIn, session: SessionDep, user: CurrentUser
) -> ApiResponse[PetOut]:
    return ok(await service.update_pet(session, user.id, pet_id, payload), message=PET_UPDATED)


@router.delete("/{pet_id}", summary="Remove a pet")
async def delete_pet(pet_id: UUID, session: SessionDep, user: CurrentUser) -> ApiResponse[PetOut]:
    return ok(await service.soft_delete_pet(session, user.id, pet_id), message=PET_DELETED)
