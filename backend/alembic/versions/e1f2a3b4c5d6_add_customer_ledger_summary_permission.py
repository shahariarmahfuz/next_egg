"""add_customer_ledger_summary_permission

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-11-17 02:10:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LEDGER_SUMMARY_PERMISSION = {
    "code": "customer.ledger.summary.view",
    "name": "View Customer Ledger Summary Cards",
    "module": "customer",
    "description": "View Opening Balance, Total Sales, Collections, Returns, Adjustments, and Current Balance summary cards on Customer Ledger",
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": LEDGER_SUMMARY_PERMISSION["code"]},
    ).first()

    if not existing:
        perm_id = str(uuid.uuid4())
        conn.execute(
            sa.text("""
                INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
                VALUES (:id, :code, :name, :module, :description, :created_at, :updated_at)
            """),
            {
                "id": perm_id,
                "code": LEDGER_SUMMARY_PERMISSION["code"],
                "name": LEDGER_SUMMARY_PERMISSION["name"],
                "module": LEDGER_SUMMARY_PERMISSION["module"],
                "description": LEDGER_SUMMARY_PERMISSION["description"],
                "created_at": now,
                "updated_at": now,
            },
        )
        # Grant initially ONLY to owner role; owner can explicitly grant to others
        owner_row = conn.execute(
            sa.text("SELECT id FROM roles WHERE code = 'owner'")
        ).first()
        if owner_row:
            already_assigned = conn.execute(
                sa.text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = :role_id AND permission_id = :perm_id
                """),
                {"role_id": owner_row[0], "perm_id": perm_id},
            ).first()
            if not already_assigned:
                conn.execute(
                    sa.text("""
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES (:role_id, :perm_id)
                    """),
                    {"role_id": owner_row[0], "perm_id": perm_id},
                )
    else:
        conn.execute(
            sa.text("""
                UPDATE permissions
                SET name = :name, module = :module, description = :description, updated_at = :updated_at
                WHERE code = :code
            """),
            {
                "code": LEDGER_SUMMARY_PERMISSION["code"],
                "name": LEDGER_SUMMARY_PERMISSION["name"],
                "module": LEDGER_SUMMARY_PERMISSION["module"],
                "description": LEDGER_SUMMARY_PERMISSION["description"],
                "updated_at": now,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()

    perm_row = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": LEDGER_SUMMARY_PERMISSION["code"]},
    ).first()

    if perm_row:
        perm_id = perm_row[0]
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )
