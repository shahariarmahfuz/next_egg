"""add_missing_expense_and_balance_adjustment_tables

Revision ID: 17666f8fbe65
Revises: 'c5e8210f9b31'
Create Date: 2026-09-20 03:34:14.484711

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '17666f8fbe65'
down_revision: Union[str, None] = 'c5e8210f9b31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. balance_adjustments table
    op.create_table(
        'balance_adjustments',
        sa.Column('entity_type', sa.String(length=20), nullable=False),
        sa.Column('entity_id', sa.String(length=36), nullable=False),
        sa.Column('previous_balance', sa.Float(), nullable=False),
        sa.Column('new_balance', sa.Float(), nullable=False),
        sa.Column('difference', sa.Float(), nullable=False),
        sa.Column('balance_type', sa.String(length=50), nullable=False),
        sa.Column('effective_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.String(length=150), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.String(length=36), nullable=False),
        sa.Column('created_by_user_name', sa.String(length=150), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_adj_created_at', 'balance_adjustments', ['created_at'], unique=False)
    op.create_index('idx_adj_entity', 'balance_adjustments', ['entity_type', 'entity_id'], unique=False)
    op.create_index(op.f('ix_balance_adjustments_entity_id'), 'balance_adjustments', ['entity_id'], unique=False)
    op.create_index(op.f('ix_balance_adjustments_entity_type'), 'balance_adjustments', ['entity_type'], unique=False)

    # 2. expense_categories table
    op.create_table(
        'expense_categories',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expense_categories_name'), 'expense_categories', ['name'], unique=True)
    op.create_index(op.f('ix_expense_categories_status'), 'expense_categories', ['status'], unique=False)

    # 3. expenses table
    op.create_table(
        'expenses',
        sa.Column('voucher_no', sa.String(length=50), nullable=False),
        sa.Column('category_id', sa.String(length=36), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('expense_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('reference_no', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.String(length=36), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['expense_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expenses_category_id'), 'expenses', ['category_id'], unique=False)
    op.create_index(op.f('ix_expenses_created_by_id'), 'expenses', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_expenses_expense_date'), 'expenses', ['expense_date'], unique=False)
    op.create_index(op.f('ix_expenses_payment_method'), 'expenses', ['payment_method'], unique=False)
    op.create_index(op.f('ix_expenses_voucher_no'), 'expenses', ['voucher_no'], unique=True)


def downgrade() -> None:
    op.drop_table('expenses')
    op.drop_table('expense_categories')
    op.drop_table('balance_adjustments')
