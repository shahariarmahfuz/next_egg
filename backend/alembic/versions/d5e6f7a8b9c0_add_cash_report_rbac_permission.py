"""add_cash_report_rbac_permission

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-10-14 11:55:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CASH_REPORT_PERMISSION = {
    "code": "cash_report.view",
    "name": "View Cash Report",
    "module": "cash_report",
    "description": "View daily cash report, cash inflow, outflow, and net balance",
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # 1. Insert or update cash_report.view permission
    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": CASH_REPORT_PERMISSION["code"]}
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
                "code": CASH_REPORT_PERMISSION["code"],
                "name": CASH_REPORT_PERMISSION["name"],
                "module": CASH_REPORT_PERMISSION["module"],
                "description": CASH_REPORT_PERMISSION["description"],
                "created_at": now,
                "updated_at": now,
            }
        )
    else:
        perm_id = existing[0]
        conn.execute(
            sa.text("""
                UPDATE permissions
                SET name = :name, module = :module, description = :description, updated_at = :updated_at
                WHERE code = :code
            """),
            {
                "code": CASH_REPORT_PERMISSION["code"],
                "name": CASH_REPORT_PERMISSION["name"],
                "module": CASH_REPORT_PERMISSION["module"],
                "description": CASH_REPORT_PERMISSION["description"],
                "updated_at": now,
            }
        )

    # 2. Grant to owner and admin roles automatically
    for role_code in ["owner", "admin"]:
        role_row = conn.execute(
            sa.text("SELECT id FROM roles WHERE code = :code"),
            {"code": role_code}
        ).first()

        if role_row:
            role_id = role_row[0]
            already_assigned = conn.execute(
                sa.text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = :role_id AND permission_id = :perm_id
                """),
                {"role_id": role_id, "perm_id": perm_id}
            ).first()

            if not already_assigned:
                conn.execute(
                    sa.text("""
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES (:role_id, :perm_id)
                    """),
                    {"role_id": role_id, "perm_id": perm_id}
                )


def downgrade() -> None:
    conn = op.get_bind()

    perm_row = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": CASH_REPORT_PERMISSION["code"]}
    ).first()

    if perm_row:
        perm_id = perm_row[0]
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id}
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id}
        )
