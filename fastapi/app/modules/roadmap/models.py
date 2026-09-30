from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import FeedbackStatus, VoteChoice
from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin
from app.db.types import IntEnumType


class RoadmapItem(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "roadmap_items"
    __table_args__ = (
        # why: titles must be unique among live rows only, so soft-deleting one frees its title.
        Index(
            "uq_roadmap_items_title_alive",
            "title",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    # why: the blurb under the title and the question that opens the comment
    # box are different jobs -- "Let a partner add to the chat" describes the
    # feature, "Who would you invite?" asks the owner something. NULL falls
    # back to a generic prompt rather than showing nothing.
    comment_prompt: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())


class RoadmapVote(UUIDPrimaryKeyMixin, AuditMixin, Base):
    __tablename__ = "roadmap_votes"
    __table_args__ = (
        # why: one vote per person per item, so casting again upserts rather than appends.
        Index("uq_roadmap_votes_item_user", "item_id", "user_id", unique=True),
    )

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("roadmap_items.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    choice: Mapped[VoteChoice] = mapped_column(IntEnumType(VoteChoice))
    note: Mapped[str | None] = mapped_column(Text)
    # why: admin-only triage state over a submission; never shown back to the
    # voter, so it lives on the same row rather than a separate audit table.
    status: Mapped[FeedbackStatus] = mapped_column(
        IntEnumType(FeedbackStatus), default=FeedbackStatus.NEW, server_default="0"
    )
