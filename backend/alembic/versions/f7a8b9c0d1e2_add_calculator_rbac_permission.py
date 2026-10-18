"""add_calculator_rbac_permission

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-10-18 10:00:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CALCULATOR_PERMISSION = {
    "code": "calculator.view",
    "name": "View & Use Calculators",
    "module": "calculator",
    "description": "Access and use business product calculators",
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # 1. Insert or update calculator.view permission
    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": CALCULATOR_PERMISSION["code"]}
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
                "code": CALCULATOR_PERMISSION["code"],
                "name": CALCULATOR_PERMISSION["name"],
                "module": CALCULATOR_PERMISSION["module"],
                "description": CALCULATOR_PERMISSION["description"],
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
                "code": CALCULATOR_PERMISSION["code"],
                "name": CALCULATOR_PERMISSION["name"],
                "module": CALCULATOR_PERMISSION["module"],
                "description": CALCULATOR_PERMISSION["description"],
                "updated_at": now,
            }
        )

    # 2. Grant to owner, admin, and employee roles automatically
    for role_code in ["owner", "admin", "employee"]:
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
        {"code": CALCULATOR_PERMISSION["code"]}
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
