"""add_physical_page_number_to_customers

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-17 01:32:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col['name'] for col in inspector.get_columns('customers')}
    if 'physical_page_number' not in columns:
        op.add_column('customers', sa.Column('physical_page_number', sa.String(length=50), nullable=True))

    indexes = {idx['name'] for idx in inspector.get_indexes('customers')}
    index_name = op.f('ix_customers_physical_page_number')
    if index_name not in indexes:
        op.create_index(index_name, 'customers', ['physical_page_number'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx['name'] for idx in inspector.get_indexes('customers')}
    index_name = op.f('ix_customers_physical_page_number')
    if index_name in indexes:
        op.drop_index(index_name, table_name='customers')

    columns = {col['name'] for col in inspector.get_columns('customers')}
    if 'physical_page_number' in columns:
        op.drop_column('customers', 'physical_page_number')
