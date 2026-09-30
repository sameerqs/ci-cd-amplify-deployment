"""add_magic_link_cognito_session

CUSTOM_AUTH is a two-call handshake: Cognito returns an opaque Session string on
initiate_auth that must be presented when the challenge is answered. The pending
magic link carries it. Null for the local provider.

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-18 18:02:56.415633

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0012'
down_revision: str | None = '0011'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('magic_link_tokens', sa.Column('cognito_session', sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column('magic_link_tokens', 'cognito_session')
