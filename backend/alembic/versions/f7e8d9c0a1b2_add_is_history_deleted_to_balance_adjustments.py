"""add_is_history_deleted_to_balance_adjustments

Revision ID: f7e8d9c0a1b2
Revises: e2f4fbcf4d62
Create Date: 2026-09-23 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7e8d9c0a1b2'
down_revision: Union[str, None] = 'e2f4fbcf4d62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'balance_adjustments',
        sa.Column(
            'is_history_deleted',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false')
        )
    )
    op.create_index(
        'idx_adj_history_active',
        'balance_adjustments',
        ['entity_type', 'entity_id', 'is_history_deleted'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('idx_adj_history_active', table_name='balance_adjustments')
    op.drop_column('balance_adjustments', 'is_history_deleted')
