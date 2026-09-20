"""create_cash_outs_table

Revision ID: 2a78d1f04e9c
Revises: 17666f8fbe65
Create Date: 2026-09-20 13:46:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a78d1f04e9c'
down_revision: Union[str, None] = '17666f8fbe65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cash_outs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('cash_out_no', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('cash_out_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_cash_out_amount_positive'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_cash_out_date', 'cash_outs', ['cash_out_date'], unique=False)
    op.create_index('idx_cash_out_no', 'cash_outs', ['cash_out_no'], unique=False)
    op.create_index(op.f('ix_cash_outs_cash_out_date'), 'cash_outs', ['cash_out_date'], unique=False)
    op.create_index(op.f('ix_cash_outs_cash_out_no'), 'cash_outs', ['cash_out_no'], unique=True)
    op.create_index(op.f('ix_cash_outs_created_by_id'), 'cash_outs', ['created_by_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_cash_outs_created_by_id'), table_name='cash_outs')
    op.drop_index(op.f('ix_cash_outs_cash_out_no'), table_name='cash_outs')
    op.drop_index(op.f('ix_cash_outs_cash_out_date'), table_name='cash_outs')
    op.drop_index('idx_cash_out_no', table_name='cash_outs')
    op.drop_index('idx_cash_out_date', table_name='cash_outs')
    op.drop_table('cash_outs')
