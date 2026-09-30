"""add_signup_requests

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-25 19:09:17.242646

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.core.enums import SignupStatus
from app.db.types import IntEnumType

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# why: a self-signup row is one the old queue wrote for itself (created_by_id = id).
# An invited user was created by an admin and never went through review.
SELF_SIGNUP = "u.created_by_id = u.id AND u.is_super_admin = false AND u.is_deleted = false"
# A never-approved row -- pending, or rejected before it ever signed in (a sub is
# only bound on a first sign-in, so a deactivated account always has one).
UNAPPROVED = "(u.status = 0 OR (u.status = 2 AND u.cognito_sub IS NULL))"
# why: every FK to users cascades, so a row is only moved out when nothing hangs
# off it. Anything that does is left where it is rather than deleted with it.
NO_CHILDREN = " AND ".join(
    f"NOT EXISTS (SELECT 1 FROM {table} c WHERE c.{column} = u.id)"
    for table, column in (
        ("pets", "owner_id"),
        ("conversations", "owner_id"),
        ("roadmap_votes", "user_id"),
        ("auth_sessions", "user_id"),
        ("magic_link_tokens", "user_id"),
    )
)


def upgrade() -> None:
    op.create_table(
        "signup_requests",
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column(
            "status", IntEnumType(SignupStatus), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "utc_inserted_datetime",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "utc_modified_datetime",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_signup_requests_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_signup_requests")),
        sa.UniqueConstraint("email", name=op.f("uq_signup_requests_email")),
    )

    # Approved self-signups keep their account and gain a request that points at it.
    op.execute(
        f"""
        INSERT INTO signup_requests (id, email, status, user_id, updated_by_id,
                                     utc_inserted_datetime, utc_modified_datetime)
        SELECT gen_random_uuid(), u.email, 1, u.id, u.updated_by_id,
               u.utc_inserted_datetime, u.utc_modified_datetime
        FROM users u
        WHERE {SELF_SIGNUP} AND u.status = 1
        """
    )
    # Pending and rejected self-signups become requests, and their account rows go:
    # under the new flow no account exists until a request is approved.
    op.execute(
        f"""
        INSERT INTO signup_requests (id, email, status, updated_by_id,
                                     utc_inserted_datetime, utc_modified_datetime)
        SELECT gen_random_uuid(), u.email, u.status,
               CASE WHEN u.status = 0 THEN NULL ELSE u.updated_by_id END,
               u.utc_inserted_datetime, u.utc_modified_datetime
        FROM users u
        WHERE {SELF_SIGNUP} AND {UNAPPROVED} AND {NO_CHILDREN}
        """
    )
    op.execute(f"DELETE FROM users u WHERE {SELF_SIGNUP} AND {UNAPPROVED} AND {NO_CHILDREN}")


def downgrade() -> None:
    # Put unapproved requests back as the account rows the old flow expects.
    op.execute(
        """
        INSERT INTO users (id, email, status, is_super_admin, created_by_id, updated_by_id,
                           utc_inserted_datetime, utc_modified_datetime, is_deleted)
        SELECT r.id, r.email, r.status, false, r.id, r.updated_by_id,
               r.utc_inserted_datetime, r.utc_modified_datetime, false
        FROM signup_requests r
        WHERE r.status IN (0, 2)
          AND r.is_deleted = false
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = r.email)
        """
    )
    op.drop_table("signup_requests")
