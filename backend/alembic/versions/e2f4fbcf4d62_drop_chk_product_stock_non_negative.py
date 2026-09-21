"""drop_chk_product_stock_non_negative

Revision ID: e2f4fbcf4d62
Revises: 2a78d1f04e9c
Create Date: 2026-09-21 16:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f4fbcf4d62'
down_revision: Union[str, None] = '2a78d1f04e9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('chk_product_stock_non_negative', 'products', type_='check', if_exists=True)


def downgrade() -> None:
    op.create_check_constraint('chk_product_stock_non_negative', 'products', 'current_stock >= 0')
