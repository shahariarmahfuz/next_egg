"""rework_farm_module

Revision ID: d9725df41f38
Revises: 'b12cd76089f1'
Create Date: 2026-09-06 12:41:01.612458

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9725df41f38'
down_revision: Union[str, None] = 'b12cd76089f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add previous_tray to farms
    op.add_column('farms', sa.Column('previous_tray', sa.Float(), server_default='0.0', nullable=False))

    # 2. Create farm_productions table
    op.create_table(
        'farm_productions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('farm_id', sa.String(length=36), nullable=False),
        sa.Column('production_date', sa.Date(), nullable=False),
        sa.Column('tray_quantity', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], name='fk_farm_productions_farm_id_farms', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_farm_productions_farm_id'), 'farm_productions', ['farm_id'], unique=False)
    op.create_index(op.f('ix_farm_productions_production_date'), 'farm_productions', ['production_date'], unique=False)

    # 3. Create farm_deliveries table
    op.create_table(
        'farm_deliveries',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('farm_id', sa.String(length=36), nullable=False),
        sa.Column('delivery_date', sa.Date(), nullable=False),
        sa.Column('destination', sa.String(length=200), nullable=False),
        sa.Column('tray_quantity', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('batch_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], name='fk_farm_deliveries_farm_id_farms', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_farm_deliveries_farm_id'), 'farm_deliveries', ['farm_id'], unique=False)
    op.create_index(op.f('ix_farm_deliveries_delivery_date'), 'farm_deliveries', ['delivery_date'], unique=False)
    op.create_index(op.f('ix_farm_deliveries_destination'), 'farm_deliveries', ['destination'], unique=False)
    op.create_index(op.f('ix_farm_deliveries_batch_id'), 'farm_deliveries', ['batch_id'], unique=False)

    # 4. Migrate existing data from farm_transactions if present
    op.execute("""
        INSERT INTO farm_productions (id, farm_id, production_date, tray_quantity, notes, created_at, updated_at)
        SELECT id, farm_id, transaction_date, COALESCE(tray_count, quantity / 30.0), notes, created_at, updated_at
        FROM farm_transactions
        WHERE transaction_type = 'PRODUCTION' AND farm_id IS NOT NULL
    """)

    op.execute("""
        INSERT INTO farm_deliveries (id, farm_id, delivery_date, destination, tray_quantity, notes, created_at, updated_at)
        SELECT id, farm_id, transaction_date, COALESCE(destination, 'General Delivery'), COALESCE(tray_count, quantity / 30.0), notes, created_at, updated_at
        FROM farm_transactions
        WHERE transaction_type = 'DELIVERY' AND farm_id IS NOT NULL
    """)

    # 5. Drop farm_transactions
    op.drop_table('farm_transactions')


def downgrade() -> None:
    # Recreate farm_transactions
    op.create_table(
        'farm_transactions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('farm_id', sa.String(length=36), nullable=True),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('transaction_type', sa.String(length=20), nullable=False),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('tray_count', sa.Float(), nullable=True),
        sa.Column('units_per_tray', sa.Float(), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('destination', sa.String(length=200), nullable=True),
        sa.Column('waste_reason', sa.String(length=200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.drop_table('farm_deliveries')
    op.drop_table('farm_productions')
    op.drop_column('farms', 'previous_tray')

