from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import MessageAuthor
from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin
from app.db.types import IntEnumType


class Conversation(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (
        # why: one live conversation per pet - the design has a single ongoing
        # chat per animal, not a thread list.
        Index(
            "uq_conversations_pet_alive",
            "pet_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    pet_id: Mapped[UUID] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class ChatMessage(UUIDPrimaryKeyMixin, AuditMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_conversation_created", "conversation_id", "utc_inserted_datetime"),
    )

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    # why: created_at is server_default=now(), which in Postgres is the
    # transaction start - every message written in one request ties, and the
    # reply could render above the question it answers. This orders them.
    ordinal: Mapped[int]
    author: Mapped[MessageAuthor] = mapped_column(IntEnumType(MessageAuthor))
    body: Mapped[str] = mapped_column(Text)
    # why: the emergency turn is rendered differently and must never be mistaken
    # for ordinary assistant chat, so it is marked on the row, not inferred.
    is_emergency_notice: Mapped[bool] = mapped_column(default=False)
    # why: the notice above is the one red line we show; this marks every turn
    # the model flagged, including the quiet ones that follow it. Keeping them
    # apart is what limits the notice to once per episode rather than once per
    # message, and it closes when an ordinary turn lands.
    is_emergency_turn: Mapped[bool] = mapped_column(default=False)


class CapturedEntry(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "captured_entries"
    __table_args__ = (Index("ix_captured_entries_pet_confirmed", "pet_id", "confirmed_at"),)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    pet_id: Mapped[UUID] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    # why: "you said, 11:07 pm" / "you added Bill.pdf" - the card shows where each
    # line came from, which is the whole point of a confirmation step.
    provenance: Mapped[str] = mapped_column(String(120))
    # why: nothing reaches the pet's profile until the owner confirms; this stamp
    # is the consent, and clearing it is the Undo.
    confirmed_at: Mapped[datetime | None]


class Attachment(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachments_pet_created", "pet_id", "utc_inserted_datetime"),)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    # why: files now ride along with the message they were sent with, which is
    # what lets the model see them in the right turn and the UI show them in the
    # right bubble. NULL is the pre-composer history, uploaded on its own.
    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"), index=True, default=None
    )
    pet_id: Mapped[UUID] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), index=True)
    # why: the name the owner saw, kept for display only. The bytes live under
    # storage_key, which is generated - never derived from this.
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int]
    storage_key: Mapped[str] = mapped_column(String(400), unique=True)
