"""add_discount_to_sale_items

Revision ID: 003_add_discount_to_sale_items
Revises: 002_make_phone_nullable
Create Date: 2026-08-04 17:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_add_discount_to_sale_items'
down_revision: Union[str, None] = '002_make_phone_nullable'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS discount FLOAT NOT NULL DEFAULT 0.0")


def downgrade() -> None:
    op.drop_column('sale_items', 'discount')
