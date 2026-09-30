"""add_user_cognito_sub

Cognito's `sub` is the stable identity for a Cognito-authenticated user: it never
changes, while an email address can. Nullable so local-provider users, which have
no Cognito record, are unaffected; unique so one Cognito identity cannot be
adopted by two rows.

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-18 18:01:13.628979

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0011'
down_revision: str | None = '0010'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('cognito_sub', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_users_cognito_sub'), 'users', ['cognito_sub'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_cognito_sub'), table_name='users')
    op.drop_column('users', 'cognito_sub')
