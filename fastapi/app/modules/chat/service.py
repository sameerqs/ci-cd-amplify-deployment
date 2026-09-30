import base64
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import UploadFile
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.analytics import track
from app.core.config import settings
from app.core.enums import MessageAuthor
from app.core.errors import BadRequestError, NotFoundError
from app.core.utils import utc_now
from app.modules.categories.models import Category
from app.modules.chat.models import (
    Attachment,
    CapturedEntry,
    ChatMessage,
    Conversation,
)
from app.modules.chat.prompts import (
    EMERGENCY_LINE,
    SYSTEM_PROMPT,
    AssistantTurn,
    ExtractedEntry,
    build_context,
)
from app.modules.chat.schemas import (
    AttachmentOut,
    CaptureCardOut,
    CapturedEntryOut,
    CapturedGroupOut,
    ChatMessageOut,
    ConversationOut,
    OwnerAttachmentOut,
)
from app.modules.pets.models import Pet

logger = logging.getLogger("app.chat")

OPENING_LINE = "Hi — tell me what's going on with {name}, in whatever order it comes out."
# why: the transcript is the model's only memory, and every turn re-sends the
# whole window -- so an unbounded history costs more on each message than it did
# on the last. The window slides: newest first until a budget runs out.
HISTORY_LIMIT = 30
# Roughly 6k tokens of text at ~4 characters each. Generous for a chat, and far
# below the point where the oldest turns are still worth what they cost.
HISTORY_CHAR_BUDGET = 24_000
# why: media is the expensive part -- one photo can outweigh the entire text
# transcript. Only the newest turns re-send their files; older ones keep a note
# that a file was there, which is enough to reason about without paying for it
# on every subsequent message.
MEDIA_RECENT_MESSAGES = 6
# What the Responses API can actually take. HEIC comes off an iPhone by default
# and .doc/.docx are accepted uploads, but none of them can be sent to the model
# -- they are kept, and the model is told they exist by name.
MODEL_READABLE_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
)


PET_ARCHIVED = "{name} is archived. Restore them from Account to keep chatting."


@dataclass(frozen=True, slots=True)
class IncomingFile:
    """An upload already read off the wire and checked against the size cap."""

    filename: str
    content_type: str
    data: bytes


async def _load_pet(
    session: AsyncSession, owner_id: UUID, pet_id: UUID, *, for_write: bool = False
) -> Pet:
    pet = await session.scalar(
        select(Pet).where(Pet.id == pet_id, Pet.owner_id == owner_id, Pet.is_deleted.is_(False))
    )
    if pet is None:
        raise NotFoundError("Pet not found")
    # why: archiving hides a pet and their chat, so the API has to enforce it -
    # leaving it to the client meant a direct call could still write.
    if for_write and pet.is_archived:
        raise BadRequestError(PET_ARCHIVED.format(name=pet.name))
    return pet


def _pet_meta(pet: Pet) -> str:
    parts = [p for p in (pet.breed, pet.age) if p]
    return " · ".join(parts) if parts else "no details given"


async def _get_or_create_conversation(
    session: AsyncSession, owner_id: UUID, pet: Pet
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.pet_id == pet.id, Conversation.is_deleted.is_(False)
        )
    )
    if conversation is not None:
        return conversation

    conversation = Conversation(
        pet_id=pet.id, owner_id=owner_id, created_by_id=owner_id, updated_by_id=owner_id
    )
    session.add(conversation)
    try:
        await session.flush()
    except IntegrityError:
        # why: a concurrent first touch of the same pet won the unique index.
        # Theirs is the live conversation; adopt it rather than 500.
        await session.rollback()
        existing = await session.scalar(
            select(Conversation).where(
                Conversation.pet_id == pet.id, Conversation.is_deleted.is_(False)
            )
        )
        if existing is None:
            raise
        return existing

    session.add(
        ChatMessage(
            conversation_id=conversation.id,
            ordinal=1,
            author=MessageAuthor.ASSISTANT,
            body=OPENING_LINE.format(name=pet.name),
            created_by_id=owner_id,
            updated_by_id=owner_id,
        )
    )
    await session.flush()
    return conversation


async def _next_ordinal(session: AsyncSession, conversation_id: UUID) -> int:
    highest = await session.scalar(
        select(func.max(ChatMessage.ordinal)).where(ChatMessage.conversation_id == conversation_id)
    )
    return (highest or 0) + 1


async def _messages(session: AsyncSession, conversation_id: UUID) -> list[ChatMessage]:
    rows = (
        await session.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.ordinal.asc())
        )
    ).scalars()
    return list(rows)


CHAT_PAGE_SIZE = 50


async def _message_page(
    session: AsyncSession,
    conversation_id: UUID,
    before: int | None,
    limit: int,
) -> tuple[list[ChatMessage], bool, int | None]:
    query = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.ordinal.desc())
        .limit(limit + 1)
    )
    if before is not None:
        query = query.where(ChatMessage.ordinal < before)
    rows = list((await session.execute(query)).scalars())
    has_more = len(rows) > limit
    page = list(reversed(rows[:limit]))
    return page, has_more, page[0].ordinal if has_more and page else None


async def _card_entries(
    session: AsyncSession, conversation_id: UUID
) -> list[tuple[CapturedEntry, Category]]:
    """The entries the card is currently showing.

    Unconfirmed entries if there are any; otherwise the most recently confirmed
    batch, so the "Saved to the pet's profile" state with its Undo stays on
    screen (design 2f) without dragging back every entry ever confirmed.
    """
    rows = (
        await session.execute(
            select(CapturedEntry, Category)
            .join(Category, Category.id == CapturedEntry.category_id)
            .where(
                CapturedEntry.conversation_id == conversation_id,
                CapturedEntry.is_deleted.is_(False),
                CapturedEntry.confirmed_at.is_(None),
            )
            .order_by(Category.name.asc(), CapturedEntry.created_at.asc())
        )
    ).all()
    if rows:
        return [(entry, category) for entry, category in rows]

    latest = await session.scalar(
        select(func.max(CapturedEntry.confirmed_at)).where(
            CapturedEntry.conversation_id == conversation_id,
            CapturedEntry.is_deleted.is_(False),
        )
    )
    if latest is None:
        return []
    confirmed = (
        await session.execute(
            select(CapturedEntry, Category)
            .join(Category, Category.id == CapturedEntry.category_id)
            .where(
                CapturedEntry.conversation_id == conversation_id,
                CapturedEntry.is_deleted.is_(False),
                CapturedEntry.confirmed_at == latest,
            )
            .order_by(Category.name.asc(), CapturedEntry.created_at.asc())
        )
    ).all()
    return [(entry, category) for entry, category in confirmed]


async def _pending_card(session: AsyncSession, conversation_id: UUID) -> CaptureCardOut | None:
    rows = await _card_entries(session, conversation_id)
    if not rows:
        return None

    grouped: dict[str, list[CapturedEntryOut]] = {}
    for entry, category in rows:
        grouped.setdefault(category.name, []).append(
            CapturedEntryOut(id=entry.id, text=entry.text, provenance=entry.provenance)
        )
    is_confirmed = all(entry.confirmed_at is not None for entry, _ in rows)
    return CaptureCardOut(
        groups=[
            CapturedGroupOut(category=name, entries=entries) for name, entries in grouped.items()
        ],
        is_confirmed=is_confirmed,
    )


async def _attachments(
    session: AsyncSession,
    conversation_id: UUID,
    message_ids: list[UUID] | None = None,
) -> list[Attachment]:
    conditions = [
        Attachment.conversation_id == conversation_id,
        Attachment.is_deleted.is_(False),
    ]
    if message_ids is not None:
        conditions.append(
            or_(Attachment.message_id.is_(None), Attachment.message_id.in_(message_ids))
        )
    rows = (
        await session.execute(
            select(Attachment).where(*conditions).order_by(Attachment.created_at.asc())
        )
    ).scalars()
    return list(rows)


def _by_message(attachments: list[Attachment]) -> dict[UUID, list[Attachment]]:
    grouped: dict[UUID, list[Attachment]] = {}
    for attachment in attachments:
        if attachment.message_id is not None:
            grouped.setdefault(attachment.message_id, []).append(attachment)
    return grouped


async def _to_out(
    session: AsyncSession,
    conversation: Conversation,
    suggested: str | None = None,
    *,
    messages: list[ChatMessage] | None = None,
    has_more_messages: bool = False,
    next_before: int | None = None,
) -> ConversationOut:
    messages = messages if messages is not None else await _messages(session, conversation.id)
    attachments = await _attachments(
        session,
        conversation.id,
        [message.id for message in messages] if messages is not None else None,
    )
    grouped = _by_message(attachments)
    return ConversationOut(
        id=conversation.id,
        pet_id=conversation.pet_id,
        messages=[
            ChatMessageOut(
                id=m.id,
                author=m.author,
                body=m.body,
                is_emergency_notice=m.is_emergency_notice,
                created_at=m.created_at,
                attachments=[AttachmentOut.model_validate(a) for a in grouped.get(m.id, [])],
            )
            for m in messages
        ],
        card=await _pending_card(session, conversation.id),
        # why: only the files that belong to no message. The rest render inside
        # their own bubble, and listing them here too drew each one twice.
        attachments=[AttachmentOut.model_validate(a) for a in attachments if a.message_id is None],
        suggested_question=suggested,
        has_more_messages=has_more_messages,
        next_before=next_before,
    )


async def list_owner_attachments(session: AsyncSession, owner_id: UUID) -> list[OwnerAttachmentOut]:
    """Every attachment the owner has added, newest first.

    Reads straight from attachments joined to pets so the account screen never
    has to open a conversation to find them -- opening one creates it, which a
    read-only screen must not do.
    """
    rows = await session.execute(
        select(Attachment, Pet.name)
        .join(Pet, Pet.id == Attachment.pet_id)
        .where(
            Pet.owner_id == owner_id,
            Pet.is_deleted.is_(False),
            Attachment.is_deleted.is_(False),
        )
        .order_by(Attachment.created_at.desc())
    )
    return [
        OwnerAttachmentOut(
            id=attachment.id,
            filename=attachment.filename,
            content_type=attachment.content_type,
            size_bytes=attachment.size_bytes,
            storage_key=attachment.storage_key,
            created_at=attachment.created_at,
            pet_id=attachment.pet_id,
            pet_name=pet_name,
        )
        for attachment, pet_name in rows.all()
    ]


async def open_conversation(session: AsyncSession, owner_id: UUID, pet_id: UUID) -> ConversationOut:
    pet = await _load_pet(session, owner_id, pet_id)
    conversation = await _get_or_create_conversation(session, owner_id, pet)
    await session.commit()
    messages, has_more, next_before = await _message_page(
        session, conversation.id, None, CHAT_PAGE_SIZE
    )
    track("chat_opened", pet_id=str(pet_id))
    return await _to_out(
        session,
        conversation,
        messages=messages,
        has_more_messages=has_more,
        next_before=next_before,
    )


async def load_message_page(
    session: AsyncSession,
    owner_id: UUID,
    pet_id: UUID,
    before: int,
) -> ConversationOut:
    pet = await _load_pet(session, owner_id, pet_id)
    conversation = await _get_or_create_conversation(session, owner_id, pet)
    messages, has_more, next_before = await _message_page(
        session, conversation.id, before, CHAT_PAGE_SIZE
    )
    await session.commit()
    return await _to_out(
        session,
        conversation,
        messages=messages,
        has_more_messages=has_more,
        next_before=next_before,
    )


def _emergency_episode_open(messages: list[ChatMessage]) -> bool:
    """True when the assistant's last turn was part of an emergency.

    why: the notice fires once per episode. Reading only the most recent
    assistant turn -- rather than asking whether the transcript contains an
    emergency anywhere -- lets a separate emergency weeks later raise its own
    fresh notice, and lets one ordinary turn close the episode.
    """
    for message in reversed(messages):
        if message.author == MessageAuthor.ASSISTANT:
            return message.is_emergency_turn
    return False


def _is_model_readable(content_type: str) -> bool:
    return content_type.split(";")[0].strip().lower() in MODEL_READABLE_TYPES


def _media_type(content_type: str) -> str:
    return content_type.split(";", 1)[0].strip().lower()


async def _file_block(attachment: Attachment) -> dict[str, Any]:
    """One attachment as a prompt block, or a note naming it if it cannot be."""
    note = {"type": "text", "text": f"[attached: {attachment.filename}]"}
    if not _is_model_readable(attachment.content_type):
        return note
    try:
        data = await storage.read(attachment.storage_key)
    except Exception:
        # why: a missing or unreadable object must not cost the owner their
        # turn. Naming the file still lets the model answer around it.
        logger.exception("Could not read %s for the prompt", attachment.storage_key)
        return note
    encoded = base64.b64encode(data).decode()
    media_type = _media_type(attachment.content_type)
    if media_type.startswith("image/"):
        return {"type": "image", "base64": encoded, "mime_type": media_type}
    return {
        "type": "file",
        "base64": encoded,
        "mime_type": media_type,
        "extras": {"filename": attachment.filename},
    }


async def _owner_content(
    message: ChatMessage, files: list[Attachment], *, with_media: bool
) -> str | list[str | dict[Any, Any]]:
    if not files:
        return message.body
    blocks: list[str | dict[Any, Any]] = []
    if message.body:
        blocks.append({"type": "text", "text": message.body})
    for attachment in files:
        blocks.append(
            await _file_block(attachment)
            if with_media
            else {"type": "text", "text": f"[attached earlier: {attachment.filename}]"}
        )
    return blocks


async def _history(
    messages: list[ChatMessage], files_by_message: dict[UUID, list[Attachment]]
) -> list[BaseMessage]:
    """The sliding window: newest backwards until the budget runs out.

    why: taking a fixed count off the end made one long message cost the same as
    twenty short ones, and re-sent every photo ever attached on every single
    turn. Walking backwards spends the budget on what is most relevant, and only
    the newest few turns pay to carry their files again.
    """
    window: list[BaseMessage] = []
    spent = 0
    for index, message in enumerate(reversed(messages[-HISTORY_LIMIT:])):
        spent += len(message.body)
        # why: `and window` keeps the newest turn even when it alone is over
        # budget -- an empty prompt is worse than an expensive one.
        if spent > HISTORY_CHAR_BUDGET and window:
            break
        if message.author != MessageAuthor.OWNER:
            window.append(AIMessage(content=message.body))
            continue
        content = await _owner_content(
            message,
            files_by_message.get(message.id, []),
            with_media=index < MEDIA_RECENT_MESSAGES,
        )
        window.append(HumanMessage(content=content))
    return list(reversed(window))


async def _ask_model(
    model: ChatOpenAI,
    pet: Pet,
    categories: list[str],
    history: list[BaseMessage],
) -> AssistantTurn | None:
    """Ask the model for one turn, or None if it could not be obtained.

    Returns None rather than raising for every failure the caller can do
    something about: a timeout, a rate limit, a provider outage, a revoked key,
    or a reply that arrived malformed or empty. The caller has already committed
    the owner's message, so None means "no answer this time" -- not "lose what
    they typed". Nothing about the provider, the key, or the exception reaches
    the client.
    """
    structured = model.with_structured_output(AssistantTurn)
    prompt: list[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        SystemMessage(content=build_context(pet.name, _pet_meta(pet), categories)),
        *history,
    ]
    try:
        result = await structured.ainvoke(prompt)
    except Exception:
        logger.exception("Assistant turn failed for pet %s", pet.id)
        return None

    if result is None:
        # with_structured_output yields None when the reply carried no parsed
        # object -- a refusal, or output cut short before the schema was filled.
        logger.warning("Assistant returned no structured turn for pet %s", pet.id)
        return None
    try:
        turn = result if isinstance(result, AssistantTurn) else AssistantTurn.model_validate(result)
    except ValidationError:
        logger.exception("Assistant turn did not match the expected shape")
        return None

    if not turn.is_emergency and not turn.reply.strip():
        # An empty reply would be saved and rendered as a blank bubble.
        logger.warning("Assistant returned an empty reply for pet %s", pet.id)
        return None
    return turn


def _emergency_reply(turn: AssistantTurn, episode_open: bool) -> tuple[str, bool]:
    """Pick what the assistant says, and whether it is the red notice.

    why: the notice is the one line the model never gets to phrase -- trusting it
    there would put advice one bad turn away -- and it opens an episode rather
    than repeating on every flagged turn. Past it the model answers in context
    like any other turn: an owner mid-emergency who asks a plain question
    deserves a plain answer, and rule 1 forbids advice on every turn anyway, so
    replacing these with fixed text bought no safety and cost the conversation.
    """
    if turn.is_emergency and not episode_open:
        return EMERGENCY_LINE, True
    return turn.reply, False


async def _capture_entries(
    session: AsyncSession,
    conversation: Conversation,
    pet: Pet,
    owner_id: UUID,
    entries: list[ExtractedEntry],
) -> None:
    """Write the turn's extracted facts down against the pet."""
    if not entries:
        return
    by_name = {
        name: cid
        for cid, name in (
            await session.execute(
                select(Category.id, Category.name).where(
                    Category.is_deleted.is_(False), Category.is_active.is_(True)
                )
            )
        ).all()
    }
    stamp = utc_now().strftime("%-I:%M %p").lower()
    for extracted in entries:
        category_id = by_name.get(extracted.category)
        if category_id is None:
            # why: the model named a category that is not on the live list;
            # dropping the entry is safer than filing it somewhere wrong.
            logger.warning("Unknown category %r from model", extracted.category)
            continue
        session.add(
            CapturedEntry(
                conversation_id=conversation.id,
                pet_id=pet.id,
                category_id=category_id,
                text=extracted.text,
                provenance=f"you said, {stamp}",
                created_by_id=owner_id,
                updated_by_id=owner_id,
            )
        )


async def send_message(
    session: AsyncSession,
    model: ChatOpenAI,
    owner_id: UUID,
    pet_id: UUID,
    body: str,
    uploads: list[IncomingFile] | None = None,
) -> ConversationOut:
    pet = await _load_pet(session, owner_id, pet_id, for_write=True)
    conversation = await _get_or_create_conversation(session, owner_id, pet)

    message = ChatMessage(
        conversation_id=conversation.id,
        ordinal=await _next_ordinal(session, conversation.id),
        author=MessageAuthor.OWNER,
        body=body,
        created_by_id=owner_id,
        updated_by_id=owner_id,
    )
    session.add(message)
    # why: the message id has to exist before the files can point at it, and the
    # files have to be stored before the commit below - otherwise a send that
    # failed mid-upload would leave rows describing bytes that are not there.
    await session.flush()
    for upload in uploads or []:
        await _store_upload(session, conversation, pet, owner_id, message.id, upload)
    # why: commit the owner's turn before calling the model. It used to be
    # flushed inside the same transaction as the LLM call, so any failure rolled
    # it back and the message the user typed vanished from the transcript with
    # nothing to retry from. What someone said is worth keeping whether or not
    # the assistant managed to answer.
    await session.commit()
    track("message_sent", pet_id=str(pet_id), has_attachments=bool(uploads))

    categories = list(
        (
            await session.execute(
                select(Category.name)
                .where(Category.is_deleted.is_(False), Category.is_active.is_(True))
                .order_by(Category.name.asc())
            )
        ).scalars()
    )
    prior = await _messages(session, conversation.id)
    history = await _history(prior, _by_message(await _attachments(session, conversation.id)))
    turn = await _ask_model(model, pet, categories, history)
    if turn is None:
        # The owner's message is already committed above, so returning the
        # conversation as it stands leaves them something to retry from.
        track("ai_reply_failed", pet_id=str(pet_id))
        return await _to_out(session, conversation)

    # why: an emergency used to suppress extraction entirely, so the turn that
    # mattered most -- the one the owner would be repeating to a vet within the
    # hour -- was the only turn pet2text wrote nothing down for.
    await _capture_entries(session, conversation, pet, owner_id, turn.entries)

    reply, is_notice = _emergency_reply(turn, _emergency_episode_open(prior))
    if is_notice:
        # why: fields only -- never the message that triggered it. The ticket
        # this satisfies is explicit that the log must carry no message text.
        track("emergency_redirect_shown", pet_id=str(pet_id))
    session.add(
        ChatMessage(
            conversation_id=conversation.id,
            ordinal=await _next_ordinal(session, conversation.id),
            author=MessageAuthor.ASSISTANT,
            body=reply,
            is_emergency_notice=is_notice,
            is_emergency_turn=turn.is_emergency,
            created_by_id=owner_id,
            updated_by_id=owner_id,
        )
    )

    await session.flush()
    await session.commit()
    messages, has_more, next_before = await _message_page(
        session, conversation.id, None, CHAT_PAGE_SIZE
    )
    return await _to_out(
        session,
        conversation,
        turn.suggested_question,
        messages=messages,
        has_more_messages=has_more,
        next_before=next_before,
    )


async def add_attachment(
    session: AsyncSession, owner_id: UUID, pet_id: UUID, upload: IncomingFile
) -> ConversationOut:
    pet = await _load_pet(session, owner_id, pet_id, for_write=True)
    conversation = await _get_or_create_conversation(session, owner_id, pet)
    await _store_upload(session, conversation, pet, owner_id, None, upload)
    await session.commit()
    return await _to_out(session, conversation)


async def _load_conversation(session: AsyncSession, owner_id: UUID, pet_id: UUID) -> Conversation:
    await _load_pet(session, owner_id, pet_id)
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.pet_id == pet_id, Conversation.is_deleted.is_(False)
        )
    )
    if conversation is None:
        raise NotFoundError("Conversation not found")
    return conversation


async def set_card_confirmed(
    session: AsyncSession, owner_id: UUID, pet_id: UUID, confirmed: bool
) -> ConversationOut:
    conversation = await _load_conversation(session, owner_id, pet_id)
    # why: act only on the batch the card is showing. Stamping or clearing every
    # entry in the conversation would retract confirmations the owner gave on
    # earlier turns, which they never asked to undo.
    rows = await _card_entries(session, conversation.id)
    stamp = utc_now() if confirmed else None
    for entry, _category in rows:
        if (entry.confirmed_at is not None) == confirmed:
            continue
        entry.confirmed_at = stamp
        entry.updated_by_id = owner_id
    await session.flush()
    await session.commit()
    return await _to_out(session, conversation)


ATTACHMENT_TOO_LARGE = "That file is larger than the {limit} MB limit."
ATTACHMENT_EMPTY = "That file is empty."
ATTACHMENT_CATEGORY = "attachment note"
UPLOAD_CHUNK_BYTES = 64 * 1024
# why: the picker's `accept` attribute is a UI convenience, not a boundary --
# anyone can POST any content-type straight to this route. This is the actual
# enforcement, and the allowed set is a photo or clinic paperwork, matching
# what the capture sheet offers.
ATTACHMENT_ALLOWED_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"}
)
ATTACHMENT_TYPE_NOT_ALLOWED = (
    "That file type isn't supported. Use a photo (JPG, PNG, HEIC) or a PDF."
)


async def read_upload(file: UploadFile) -> IncomingFile:
    """Read an upload, stopping as soon as it exceeds the cap.

    why: reading the whole body first and checking the size afterwards means an
    arbitrarily large upload is fully materialised before it is rejected.
    """
    media_type = _media_type(file.content_type or "")
    if media_type not in ATTACHMENT_ALLOWED_TYPES:
        track("attachment_failed", reason="unsupported_type", content_type=file.content_type)
        raise BadRequestError(ATTACHMENT_TYPE_NOT_ALLOWED)
    limit = settings.ATTACHMENT_MAX_BYTES
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(UPLOAD_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            track("attachment_failed", reason="too_large", content_type=file.content_type)
            raise BadRequestError(ATTACHMENT_TOO_LARGE.format(limit=limit // (1024 * 1024)))
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        track("attachment_failed", reason="empty", content_type=file.content_type)
        raise BadRequestError(ATTACHMENT_EMPTY)
    return IncomingFile(
        filename=Path(file.filename or "attachment").name[:255] or "attachment",
        content_type=file.content_type or "application/octet-stream",
        data=data,
    )


async def _store_upload(
    session: AsyncSession,
    conversation: Conversation,
    pet: Pet,
    owner_id: UUID,
    message_id: UUID | None,
    upload: IncomingFile,
) -> None:
    """Put the bytes away and hang the row off the message that carried them."""
    key = storage.build_key(str(pet.id), upload.filename)
    stored = await storage.put(key, upload.data, upload.content_type)
    track(
        "attachment_uploaded",
        pet_id=str(pet.id),
        content_type=upload.content_type,
        size_bytes=stored.size_bytes,
    )

    session.add(
        Attachment(
            conversation_id=conversation.id,
            message_id=message_id,
            pet_id=pet.id,
            filename=upload.filename,
            content_type=upload.content_type,
            size_bytes=stored.size_bytes,
            storage_key=stored.key,
            created_by_id=owner_id,
            updated_by_id=owner_id,
        )
    )

    # why: only the attachment-note category will do. Falling back to an
    # arbitrary active one contradicted the drop-on-unknown-category rule that
    # governs model-extracted entries, and mislabelled the owner's own record.
    category_id = await session.scalar(
        select(Category.id).where(
            Category.is_deleted.is_(False),
            Category.is_active.is_(True),
            func.lower(Category.name) == ATTACHMENT_CATEGORY,
        )
    )
    if category_id is None:
        logger.warning(
            "No active %r category; %s kept without a card entry",
            ATTACHMENT_CATEGORY,
            upload.filename,
        )
        return
    stamp = utc_now().strftime("%-I:%M %p").lower()
    session.add(
        CapturedEntry(
            conversation_id=conversation.id,
            pet_id=pet.id,
            category_id=category_id,
            text=f"{upload.filename} attached",
            provenance=f"you added {upload.filename}, {stamp}",
            created_by_id=owner_id,
            updated_by_id=owner_id,
        )
    )


async def resolve_attachment(session: AsyncSession, owner_id: UUID, storage_key: str) -> Attachment:
    attachment = await session.scalar(
        select(Attachment)
        .join(Pet, Pet.id == Attachment.pet_id)
        .where(
            Attachment.storage_key == storage_key,
            Attachment.is_deleted.is_(False),
            Pet.owner_id == owner_id,
            Pet.is_deleted.is_(False),
        )
    )
    if attachment is None:
        raise NotFoundError("File not found")
    return attachment
