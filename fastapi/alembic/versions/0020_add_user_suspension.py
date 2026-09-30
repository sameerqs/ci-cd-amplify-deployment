"""add_user_suspension

Revision ID: 0020
Revises: 0019

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("suspended_by_id", sa.Uuid(), nullable=True))

    # why: since 0019 a REJECTED account row can only be one an admin deactivated
    # (rejected signups live in signup_requests), which is what SUSPENDED means.
    # The last modification is the best record left of when that happened.
    op.execute(
        """
        UPDATE users
        SET status = 3, suspended_at = utc_modified_datetime, suspended_by_id = updated_by_id
        WHERE status = 2
        """
    )
    # When each account became usable: its approval if it came through signup,
    # otherwise its creation (invited users and the Super Admin).
    op.execute(
        """
        UPDATE users u
        SET activated_at = COALESCE(
            (SELECT r.utc_modified_datetime FROM signup_requests r
             WHERE r.user_id = u.id AND r.status = 1),
            u.utc_inserted_datetime
        )
        WHERE u.status IN (1, 3)
        """
    )


def downgrade() -> None:
    op.execute("UPDATE users SET status = 2 WHERE status = 3")
    op.drop_column("users", "suspended_by_id")
    op.drop_column("users", "suspended_at")
    op.drop_column("users", "activated_at")
