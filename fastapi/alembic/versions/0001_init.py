"""init

Revision ID: 0001
Revises: 
Create Date: 2026-09-08 22:52:58.815074

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('roles',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('external_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
    sa.UniqueConstraint('external_id', name=op.f('uq_roles_external_id')),
    sa.UniqueConstraint('name', name=op.f('uq_roles_name'))
    )
    op.create_table('users',
    sa.Column('email', sa.String(length=100), nullable=False),
    sa.Column('first_name', sa.String(length=50), nullable=True),
    sa.Column('last_name', sa.String(length=50), nullable=True),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('role_id', sa.Integer(), nullable=True),
    sa.Column('phone', sa.String(length=32), nullable=True),
    sa.Column('gender', sa.Integer(), nullable=True),
    sa.Column('address1', sa.String(length=150), nullable=True),
    sa.Column('address2', sa.String(length=150), nullable=True),
    sa.Column('city', sa.String(length=50), nullable=True),
    sa.Column('province', sa.String(length=50), nullable=True),
    sa.Column('postal', sa.String(length=10), nullable=True),
    sa.Column('country', sa.String(length=50), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('token_version', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('reset_token_hash', sa.String(length=64), nullable=True),
    sa.Column('reset_token_expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_by_id', sa.Uuid(), nullable=True),
    sa.Column('updated_by_id', sa.Uuid(), nullable=True),
    sa.Column('utc_inserted_datetime', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('utc_modified_datetime', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.external_id'], name=op.f('fk_users_role_id_roles'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.create_index('uq_users_one_super_admin_alive', 'users', ['role_id'], unique=True, postgresql_where=sa.text('role_id = 0 AND is_deleted = false'))
    op.create_table('refresh_tokens',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('replaced_by_token_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_by_id', sa.Uuid(), nullable=True),
    sa.Column('updated_by_id', sa.Uuid(), nullable=True),
    sa.Column('utc_inserted_datetime', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('utc_modified_datetime', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.ForeignKeyConstraint(['replaced_by_token_id'], ['refresh_tokens.id'], name=op.f('fk_refresh_tokens_replaced_by_token_id_refresh_tokens'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_refresh_tokens_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_refresh_tokens')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_refresh_tokens_token_hash'))
    )
    op.create_index(op.f('ix_refresh_tokens_expires_at'), 'refresh_tokens', ['expires_at'], unique=False)
    op.create_index('ix_refresh_tokens_user_id_revoked_at', 'refresh_tokens', ['user_id', 'revoked_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_user_id_revoked_at', table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_expires_at'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index('uq_users_one_super_admin_alive', table_name='users', postgresql_where=sa.text('role_id = 0 AND is_deleted = false'))
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
    op.drop_table('users')
    op.drop_table('roles')
