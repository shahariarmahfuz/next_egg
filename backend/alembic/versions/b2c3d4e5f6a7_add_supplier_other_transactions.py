"""add supplier other transactions table

Revision ID: b2c3d4e5f6a7
Revises: f7e8d9c0a1b2
Create Date: 2026-09-30 10:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'f7e8d9c0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'supplier_other_transactions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('voucher_no', sa.String(length=50), nullable=False),
        sa.Column('supplier_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('transaction_type', sa.String(length=50), nullable=False, server_default='other_payable'),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reference_no', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_sot_amount_positive'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_sot_voucher_no', 'supplier_other_transactions', ['voucher_no'], unique=True)
    op.create_index('idx_sot_supplier', 'supplier_other_transactions', ['supplier_id'], unique=False)
    op.create_index('idx_sot_date', 'supplier_other_transactions', ['transaction_date'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_sot_date', table_name='supplier_other_transactions')
    op.drop_index('idx_sot_supplier', table_name='supplier_other_transactions')
    op.drop_index('idx_sot_voucher_no', table_name='supplier_other_transactions')
    op.drop_table('supplier_other_transactions')
