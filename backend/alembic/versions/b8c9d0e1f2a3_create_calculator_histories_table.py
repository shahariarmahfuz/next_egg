"""create_calculator_histories_table

Revision ID: b8c9d0e1f2a3
Revises: a1b2c3d4e5f6
Create Date: 2026-11-13 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calculator_histories',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('calculator_type', sa.String(length=50), nullable=False),
        sa.Column('calculation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=True),
        sa.Column('product_name', sa.String(length=150), nullable=True),
        sa.Column('system_stock', sa.Integer(), nullable=True),
        sa.Column('eggs_per_tray', sa.Integer(), nullable=False),
        sa.Column('stacks', sa.JSON(), nullable=False),
        sa.Column('loose_entries', sa.JSON(), nullable=False),
        sa.Column('next_day_sell', sa.Integer(), nullable=False),
        sa.Column('total_trays', sa.Integer(), nullable=False),
        sa.Column('total_tray_eggs', sa.Integer(), nullable=False),
        sa.Column('total_loose_eggs', sa.Integer(), nullable=False),
        sa.Column('next_day_sell_eggs', sa.Integer(), nullable=False),
        sa.Column('grand_total_eggs', sa.Integer(), nullable=False),
        sa.Column('full_trays', sa.Integer(), nullable=False),
        sa.Column('remainder_eggs', sa.Integer(), nullable=False),
        sa.Column('stock_difference', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_calc_history_user_date', 'calculator_histories', ['user_id', 'calculation_date', 'is_deleted'], unique=False)
    op.create_index(op.f('ix_calculator_histories_user_id'), 'calculator_histories', ['user_id'], unique=False)
    op.create_index(op.f('ix_calculator_histories_calculator_type'), 'calculator_histories', ['calculator_type'], unique=False)
    op.create_index(op.f('ix_calculator_histories_calculation_date'), 'calculator_histories', ['calculation_date'], unique=False)
    op.create_index(op.f('ix_calculator_histories_product_id'), 'calculator_histories', ['product_id'], unique=False)
    op.create_index(op.f('ix_calculator_histories_is_deleted'), 'calculator_histories', ['is_deleted'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_calculator_histories_is_deleted'), table_name='calculator_histories')
    op.drop_index(op.f('ix_calculator_histories_product_id'), table_name='calculator_histories')
    op.drop_index(op.f('ix_calculator_histories_calculation_date'), table_name='calculator_histories')
    op.drop_index(op.f('ix_calculator_histories_calculator_type'), table_name='calculator_histories')
    op.drop_index(op.f('ix_calculator_histories_user_id'), table_name='calculator_histories')
    op.drop_index('idx_calc_history_user_date', table_name='calculator_histories')
    op.drop_table('calculator_histories')
