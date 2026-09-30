"""add_user_status_onboarding

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-16 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('status', sa.Integer(), server_default=sa.text('0'), nullable=False))
    op.execute('UPDATE users SET status = CASE WHEN is_active THEN 1 ELSE 2 END')
    op.add_column('users', sa.Column('full_name', sa.String(length=100), nullable=True))
    op.execute(
        "UPDATE users SET full_name = left("
        "coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), email), 100)"
    )
    op.alter_column('users', 'full_name', existing_type=sa.String(length=100), nullable=False)
    op.add_column('users', sa.Column('onboarding_completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('age_confirmed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('users', sa.Column('beta_disclaimer_accepted', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.drop_column('users', 'is_active')


def downgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.execute('UPDATE users SET is_active = (status = 1)')
    op.drop_column('users', 'beta_disclaimer_accepted')
    op.drop_column('users', 'age_confirmed')
    op.drop_column('users', 'onboarding_completed_at')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'status')
