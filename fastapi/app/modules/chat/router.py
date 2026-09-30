from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile

from app.core.deps import CurrentUser, SessionDep
from app.core.envelope import ApiResponse, Items, ok, ok_items
from app.core.errors import BadRequestError
from app.core.llm import ChatModelProviderDep
from app.modules.chat import service
from app.modules.chat.schemas import ConversationOut, OwnerAttachmentOut, SendMessageIn

attachments_router = APIRouter(prefix="/attachments", tags=["Chat"])
router = APIRouter(prefix="/pets/{pet_id}/chat", tags=["Chat"])
# why: a conversation belongs to the pet's owner. Every route resolves the pet
# through the caller's id first, so another owner's chat reads as 404.

CARD_CONFIRMED = "Saved to the pet's profile"
CARD_UNDONE = "Undone — nothing was saved"
NOTHING_TO_SEND = "Type something or attach a file."


@router.get("", summary="Open the pet's conversation")
async def open_conversation(
    pet_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[ConversationOut]:
    return ok(await service.open_conversation(session, user.id, pet_id))


@router.get("/messages", summary="Load older messages from the conversation")
async def load_messages(
    pet_id: UUID,
    before: Annotated[int, Query(gt=1)],
    session: SessionDep,
    user: CurrentUser,
) -> ApiResponse[ConversationOut]:
    return ok(await service.load_message_page(session, user.id, pet_id, before))


@router.post("/messages", summary="Say something, with or without files")
async def send_message(
    pet_id: UUID,
    session: SessionDep,
    user: CurrentUser,
    model_provider: ChatModelProviderDep,
    payload: Annotated[SendMessageIn, Form()],
) -> ApiResponse[ConversationOut]:
    body = payload.body.strip()
    uploads = [await service.read_upload(f) for f in payload.files if f.filename]
    # why: a turn has to carry something. Without this an empty submit wrote a
    # blank bubble and spent a model call on nothing.
    if not body and not uploads:
        raise BadRequestError(NOTHING_TO_SEND)
    return ok(await service.send_message(session, model_provider(), user.id, pet_id, body, uploads))


@router.post("/attachments", summary="Attach a photo or file to this chat")
async def add_attachment(
    pet_id: UUID,
    session: SessionDep,
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
) -> ApiResponse[ConversationOut]:
    upload = await service.read_upload(file)
    return ok(await service.add_attachment(session, user.id, pet_id, upload))


@router.post("/card/confirm", summary="Confirm what was captured")
async def confirm_card(
    pet_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[ConversationOut]:
    card = await service.set_card_confirmed(session, user.id, pet_id, True)
    return ok(card, message=CARD_CONFIRMED)


@router.post("/card/undo", summary="Undo a confirmation")
async def undo_card(
    pet_id: UUID, session: SessionDep, user: CurrentUser
) -> ApiResponse[ConversationOut]:
    card = await service.set_card_confirmed(session, user.id, pet_id, False)
    return ok(card, message=CARD_UNDONE)


@attachments_router.get("", summary="Everything you have attached, across your pets")
async def list_attachments(
    session: SessionDep, user: CurrentUser
) -> ApiResponse[Items[OwnerAttachmentOut]]:
    return ok_items(await service.list_owner_attachments(session, user.id))
