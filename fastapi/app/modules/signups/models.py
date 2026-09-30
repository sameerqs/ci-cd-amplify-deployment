from uuid import UUID

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import SignupStatus
from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin
from app.db.types import IntEnumType


class SignupRequest(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    """An address asking for an account. No user row or pool user exists until approval."""

    __tablename__ = "signup_requests"

    # why: one row per address for good -- a rejection stays on record, and that is
    # what stops the same address from simply asking again.
    email: Mapped[str] = mapped_column(String(100), unique=True)
    status: Mapped[SignupStatus] = mapped_column(
        IntEnumType(SignupStatus), default=SignupStatus.PENDING, server_default=text("0")
    )
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))

    @property
    def display_name(self) -> str:
        return self.email
