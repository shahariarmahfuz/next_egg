"""add_farm_entries_and_entry_id

Revision ID: e2b3c4d5e6f7
Revises: d9725df41f38
Create Date: 2026-09-07 11:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2b3c4d5e6f7'
down_revision: Union[str, None] = 'd9725df41f38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'farm_entries' not in tables:
        op.create_table(
            'farm_entries',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('farm_id', sa.String(length=36), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('production_trays', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], name='fk_farm_entries_farm_id_farms', ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_farm_entries_farm_id'), 'farm_entries', ['farm_id'], unique=False)
        op.create_index(op.f('ix_farm_entries_date'), 'farm_entries', ['date'], unique=False)

    delivery_cols = [c['name'] for c in inspector.get_columns('farm_deliveries')]
    if 'entry_id' not in delivery_cols:
        op.add_column('farm_deliveries', sa.Column('entry_id', sa.String(length=36), nullable=True))
        op.create_foreign_key(
            'fk_farm_deliveries_entry_id_farm_entries',
            'farm_deliveries',
            'farm_entries',
            ['entry_id'],
            ['id'],
            ondelete='CASCADE'
        )
        op.create_index(op.f('ix_farm_deliveries_entry_id'), 'farm_deliveries', ['entry_id'], unique=False)


def downgrade() -> None:
    op.drop_column('farm_deliveries', 'entry_id')
    op.drop_table('farm_entries')
