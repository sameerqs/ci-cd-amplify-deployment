from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import UploadFile
from pydantic import Field, StringConstraints

from app.core.enums import MessageAuthor
from app.core.schemas import InputSchema, OutputSchema

# why: empty is allowed now -- a photo sent with nothing typed is a whole
# message. The router rejects the case where neither text nor a file arrived.
MessageBody = Annotated[str, StringConstraints(max_length=4000)]


class CapturedEntryOut(OutputSchema):
    id: UUID
    text: str
    provenance: str


class CapturedGroupOut(OutputSchema):
    category: str
    entries: list[CapturedEntryOut]


class CaptureCardOut(OutputSchema):
    """The pending confirmation card (design 2f), or None when nothing is pending."""

    groups: list[CapturedGroupOut]
    is_confirmed: bool


class AttachmentOut(OutputSchema):
    id: UUID
    filename: str
    content_type: str
    size_bytes: int
    # why: the client needs this to build the /files/{key} download URL. Without
    # it the download route and the Next proxy were both unreachable.
    storage_key: str
    created_at: datetime


class ChatMessageOut(OutputSchema):
    id: UUID
    author: MessageAuthor
    body: str
    is_emergency_notice: bool
    created_at: datetime
    # why: files ride with the message that carried them, so they render in that
    # bubble instead of floating in the timeline beside it.
    attachments: list[AttachmentOut] = Field(default_factory=list)


class OwnerAttachmentOut(AttachmentOut):
    """An attachment with the pet it belongs to, for the account screen."""

    pet_id: UUID
    pet_name: str


class ConversationOut(OutputSchema):
    id: UUID
    pet_id: UUID
    messages: list[ChatMessageOut]
    card: CaptureCardOut | None
    attachments: list[AttachmentOut]
    suggested_question: str | None
    has_more_messages: bool = False
    next_before: int | None = None


class SendMessageIn(InputSchema):
    """The composer's turn: what was typed, what was attached, or both.

    why: this is a multipart form, not JSON -- FastAPI only flattens a Form
    model when it is the whole body, so the files belong in here rather than as
    a second parameter. extra="forbid" still applies, so a stray field is a 422.
    """

    body: MessageBody = Field(default="", description="What the owner typed")
    files: list[UploadFile] = Field(
        default_factory=list, description="Photos or documents sent with it"
    )
