from sqlalchemy import Index, String, text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin


class Category(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        # why: names must be unique among live rows only - a soft-deleted category must not
        # block an admin from re-creating one with the same name.
        Index(
            "uq_categories_name_alive",
            "name",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
