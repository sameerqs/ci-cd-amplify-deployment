"""link_attachments_to_messages

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0016'
down_revision: str | None = '0015'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable on purpose: attachments uploaded before the composer carried them
    # belong to no message, and they keep rendering on their own in the timeline.
    op.add_column('attachments', sa.Column('message_id', sa.Uuid(), nullable=True))
    op.create_index(
        op.f('ix_attachments_message_id'), 'attachments', ['message_id'], unique=False
    )
    op.create_foreign_key(
        op.f('fk_attachments_message_id_chat_messages'),
        'attachments',
        'chat_messages',
        ['message_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f('fk_attachments_message_id_chat_messages'), 'attachments', type_='foreignkey'
    )
    op.drop_index(op.f('ix_attachments_message_id'), table_name='attachments')
    op.drop_column('attachments', 'message_id')
