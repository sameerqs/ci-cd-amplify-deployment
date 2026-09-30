"""remove roles and add a single super-admin flag

Revision ID: 0014
Revises: 0013
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_super_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.execute("UPDATE users SET is_super_admin = true WHERE role_id = 0")
    op.drop_index("uq_users_one_super_admin_alive", table_name="users")
    op.drop_index(op.f("ix_users_role_id"), table_name="users")
    op.drop_constraint("fk_users_role_id_roles", "users", type_="foreignkey")
    op.drop_column("users", "role_id")
    op.drop_table("roles")
    op.create_index(
        "uq_users_one_super_admin_alive",
        "users",
        ["is_super_admin"],
        unique=True,
        postgresql_where=sa.text("is_super_admin = true AND is_deleted = false"),
    )


def downgrade() -> None:
    op.add_column("users", sa.Column("role_id", sa.Integer(), nullable=True))
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("external_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
        sa.UniqueConstraint("external_id", name=op.f("uq_roles_external_id")),
        sa.UniqueConstraint("name", name=op.f("uq_roles_name")),
    )
    op.bulk_insert(
        sa.table(
            "roles",
            sa.column("external_id", sa.Integer()),
            sa.column("name", sa.String()),
        ),
        [
            {"external_id": 0, "name": "Super Admin"},
            {"external_id": 1, "name": "Admin"},
            {"external_id": 2, "name": "User"},
        ],
    )
    op.execute("UPDATE users SET role_id = CASE WHEN is_super_admin THEN 0 ELSE 2 END")
    op.alter_column("users", "role_id", nullable=False)
    op.create_foreign_key(
        "fk_users_role_id_roles",
        "users",
        "roles",
        ["role_id"],
        ["external_id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_users_role_id"), "users", ["role_id"], unique=False)
    op.drop_index("uq_users_one_super_admin_alive", table_name="users")
    op.create_index(
        "uq_users_one_super_admin_alive",
        "users",
        ["role_id"],
        unique=True,
        postgresql_where=sa.text("role_id = 0 AND is_deleted = false"),
    )
    op.drop_column("users", "is_super_admin")
