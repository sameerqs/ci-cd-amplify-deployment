from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import Species
from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin
from app.db.types import IntEnumType


class Pet(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "pets"
    __table_args__ = (
        # why: names only have to be unique per owner among live rows - two
        # different owners may both have a "Milo", and archiving frees the name.
        Index(
            "uq_pets_owner_name_alive",
            "owner_id",
            "name",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    species: Mapped[Species] = mapped_column(IntEnumType(Species))
    # why: free text, not a number - owners write "7 yrs", "about 3", "6 months".
    age: Mapped[str | None] = mapped_column(String(20))
    weight: Mapped[str | None] = mapped_column(String(20))
    breed: Mapped[str | None] = mapped_column(String(50))
    # why: archiving hides a pet and their chat without deleting anything, so it
    # is a distinct state from the soft-delete used for real removal.
    is_archived: Mapped[bool] = mapped_column(default=False, server_default=false())
