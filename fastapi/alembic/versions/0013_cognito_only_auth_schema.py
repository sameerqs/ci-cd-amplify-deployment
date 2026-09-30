"""cognito_only_auth_schema

Replaces the local-JWT session store with the Cognito session vault, and
narrows users to what this product actually asks a person for.

Destructive by design: the dropped columns hold data this application no longer
collects, and refresh_tokens rows are credentials for a scheme that no longer
exists. Everyone is signed out by this migration and signs in again through the
email link -- there is nothing to migrate, because a Cognito refresh token was
never stored to carry over.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

USER_COLUMNS_DROPPED = [
    ("first_name", sa.String(length=50), True),
    ("last_name", sa.String(length=50), True),
    ("password_hash", sa.String(length=255), True),
    ("phone", sa.String(length=32), True),
    ("gender", sa.Integer(), True),
    ("address1", sa.String(length=150), True),
    ("address2", sa.String(length=150), True),
    ("city", sa.String(length=50), True),
    ("province", sa.String(length=50), True),
    ("postal", sa.String(length=10), True),
    ("country", sa.String(length=50), True),
    ("must_change_password", sa.Boolean(), False),
    ("token_version", sa.Integer(), False),
    ("reset_token_hash", sa.String(length=64), True),
    ("reset_token_expires_at", sa.DateTime(timezone=True), True),
]


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_enc", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_auth_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_auth_sessions_token_hash")),
    )
    op.create_index(
        op.f("ix_auth_sessions_expires_at"), "auth_sessions", ["expires_at"], unique=False
    )
    op.create_index(
        "ix_auth_sessions_user_id_revoked_at", "auth_sessions", ["user_id", "revoked_at"]
    )

    op.drop_index("ix_refresh_tokens_user_id_revoked_at", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_expires_at", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    for name, _type, _nullable in USER_COLUMNS_DROPPED:
        op.drop_column("users", name)


def downgrade() -> None:
    for name, column_type, nullable in reversed(USER_COLUMNS_DROPPED):
        # why: the dropped data is gone, so the restored columns need a default
        # the existing rows can take. Booleans and counters get theirs; the rest
        # come back empty, which is what they were for anyone who never filled
        # them in.
        server_default = None
        if name == "must_change_password":
            server_default = sa.false()
        elif name == "token_version":
            server_default = sa.text("0")
        op.add_column(
            "users",
            sa.Column(name, column_type, nullable=nullable, server_default=server_default),
        )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_token_id", sa.Uuid(), nullable=True),
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
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(
            ["replaced_by_token_id"],
            ["refresh_tokens.id"],
            name=op.f("fk_refresh_tokens_replaced_by_token_id_refresh_tokens"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_refresh_tokens_expires_at"), "refresh_tokens", ["expires_at"], unique=False
    )
    op.create_index(
        "ix_refresh_tokens_user_id_revoked_at", "refresh_tokens", ["user_id", "revoked_at"]
    )

    op.drop_index("ix_auth_sessions_user_id_revoked_at", table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_expires_at"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
