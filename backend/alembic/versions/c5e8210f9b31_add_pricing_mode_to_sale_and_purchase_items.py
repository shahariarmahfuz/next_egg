"""add_pricing_mode_to_sale_and_purchase_items

Revision ID: c5e8210f9b31
Revises: 21a970c52546
Create Date: 2026-09-20 03:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e8210f9b31'
down_revision: Union[str, None] = '21a970c52546'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sale_items', sa.Column('pricing_mode', sa.String(length=20), server_default=sa.text("'unit_price'"), nullable=False))
    op.add_column('purchase_items', sa.Column('pricing_mode', sa.String(length=20), server_default=sa.text("'unit_price'"), nullable=False))


def downgrade() -> None:
    op.drop_column('purchase_items', 'pricing_mode')
    op.drop_column('sale_items', 'pricing_mode')
