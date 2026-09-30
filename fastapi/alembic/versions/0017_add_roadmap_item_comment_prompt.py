"""add_roadmap_item_comment_prompt

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-21 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0017'
down_revision: str | None = '0016'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'roadmap_items', sa.Column('comment_prompt', sa.String(length=200), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('roadmap_items', 'comment_prompt')
