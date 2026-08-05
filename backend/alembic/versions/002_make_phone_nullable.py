"""make_phone_nullable

Revision ID: 002_make_phone_nullable
Revises: 001_enterprise_schema
Create Date: 2026-08-04 15:56:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_make_phone_nullable'
down_revision: Union[str, None] = '001_enterprise_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('suppliers', 'phone', existing_type=sa.String(length=30), nullable=True)
    op.execute("ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_phone_key")
    op.alter_column('customers', 'phone', existing_type=sa.String(length=30), nullable=True)
    op.execute("ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key")


def downgrade() -> None:
    op.alter_column('suppliers', 'phone', existing_type=sa.String(length=30), nullable=False)
    op.create_unique_constraint('suppliers_phone_key', 'suppliers', ['phone'])
    op.alter_column('customers', 'phone', existing_type=sa.String(length=30), nullable=False)
    op.create_unique_constraint('customers_phone_key', 'customers', ['phone'])
