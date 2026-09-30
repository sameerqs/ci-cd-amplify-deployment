"""add_chat_message_emergency_turn

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0015'
down_revision: str | None = '0014'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'chat_messages',
        sa.Column('is_emergency_turn', sa.Boolean(), nullable=True),
    )
    # Every emergency turn written before this column existed was also a notice,
    # so the old flag is an exact backfill. Doing it before the NOT NULL lands
    # keeps an upgrade over live data from failing.
    op.execute('UPDATE chat_messages SET is_emergency_turn = is_emergency_notice')
    op.alter_column('chat_messages', 'is_emergency_turn', nullable=False)


def downgrade() -> None:
    op.drop_column('chat_messages', 'is_emergency_turn')
