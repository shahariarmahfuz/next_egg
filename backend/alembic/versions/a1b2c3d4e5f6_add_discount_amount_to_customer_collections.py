"""add_discount_amount_to_customer_collections

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-10-23 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'customer_collections',
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0')
    )
    op.drop_constraint('chk_col_amount_positive', 'customer_collections', type_='check', if_exists=True)
    op.create_check_constraint(
        'chk_col_amount_positive',
        'customer_collections',
        'amount >= 0 AND discount_amount >= 0 AND (amount + discount_amount) > 0'
    )


def downgrade() -> None:
    op.drop_constraint('chk_col_amount_positive', 'customer_collections', type_='check', if_exists=True)
    op.create_check_constraint('chk_col_amount_positive', 'customer_collections', 'amount > 0')
    op.drop_column('customer_collections', 'discount_amount')
