from datetime import datetime
from uuid import UUID

from sqlalchemy import Index, String, Uuid, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import UserStatus
from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin
from app.db.types import IntEnumType


class User(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    """A pet owner.

    Deliberately narrow: this product asks for an email address, an age
    confirmation and a disclaimer acceptance, so those are the only facts it
    keeps. Authentication is Cognito's, which is why there is no password here
    and `cognito_sub` is the identity everything else resolves through.
    """

    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_one_super_admin_alive",
            "is_super_admin",
            unique=True,
            postgresql_where=text("is_super_admin = true AND is_deleted = false"),
        ),
    )

    email: Mapped[str] = mapped_column(String(100), unique=True)
    # why: Cognito's sub is the stable identity -- it never changes, an email can.
    # Nullable until the pool has vouched for the address at least once.
    cognito_sub: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    is_super_admin: Mapped[bool] = mapped_column(default=False, server_default=false())
    status: Mapped[UserStatus] = mapped_column(
        IntEnumType(UserStatus), default=UserStatus.PENDING, server_default=text("0")
    )
    # why: when the account last became usable (approval, invite or restore) and,
    # while suspended, when and by whom. Cleared on restore -- the audit columns
    # already record who changed the row last.
    activated_at: Mapped[datetime | None]
    suspended_at: Mapped[datetime | None]
    suspended_by_id: Mapped[UUID | None] = mapped_column(Uuid)
    onboarding_completed_at: Mapped[datetime | None]
    age_confirmed: Mapped[bool] = mapped_column(default=False, server_default=false())
    beta_disclaimer_accepted: Mapped[bool] = mapped_column(default=False, server_default=false())

    @property
    def display_name(self) -> str:
        return self.email
