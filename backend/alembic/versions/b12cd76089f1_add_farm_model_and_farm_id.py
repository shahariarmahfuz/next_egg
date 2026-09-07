"""add_farm_model_and_farm_id

Revision ID: b12cd76089f1
Revises: '9979569087e0'
Create Date: 2026-09-06 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b12cd76089f1'
down_revision: Union[str, None] = '9979569087e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'farms',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('contact_number', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_farms_name'), 'farms', ['name'], unique=False)
    op.create_index(op.f('ix_farms_code'), 'farms', ['code'], unique=True)
    op.create_index(op.f('ix_farms_status'), 'farms', ['status'], unique=False)

    op.add_column('farm_transactions', sa.Column('farm_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_farm_transactions_farm_id'), 'farm_transactions', ['farm_id'], unique=False)
    op.create_foreign_key('fk_farm_transactions_farm_id_farms', 'farm_transactions', 'farms', ['farm_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_farm_transactions_farm_id_farms', 'farm_transactions', type_='foreignkey')
    op.drop_index(op.f('ix_farm_transactions_farm_id'), table_name='farm_transactions')
    op.drop_column('farm_transactions', 'farm_id')

    op.drop_index(op.f('ix_farms_status'), table_name='farms')
    op.drop_index(op.f('ix_farms_code'), table_name='farms')
    op.drop_index(op.f('ix_farms_name'), table_name='farms')
    op.drop_table('farms')
