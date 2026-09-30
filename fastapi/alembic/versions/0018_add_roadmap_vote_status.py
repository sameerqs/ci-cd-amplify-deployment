"""add_roadmap_vote_status

Revision ID: 0018
Revises: 0017
Create Date: 2026-09-21 22:34:06.421776

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.core.enums import FeedbackStatus
from app.db.types import IntEnumType

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "roadmap_votes",
        sa.Column(
            "status",
            IntEnumType(FeedbackStatus),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("roadmap_votes", "status")
