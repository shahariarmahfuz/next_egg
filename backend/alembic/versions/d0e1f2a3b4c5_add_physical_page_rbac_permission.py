"""add_physical_page_rbac_permission

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-11-17 01:52:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PHYSICAL_PAGE_PERMISSION = {
    "code": "customer.physical_page.manage",
    "name": "Set / Remove Physical Page Number",
    "module": "customer",
    "description": "Add, update, or remove customer physical ledger page numbers",
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    existing = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": PHYSICAL_PAGE_PERMISSION["code"]},
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
                "code": PHYSICAL_PAGE_PERMISSION["code"],
                "name": PHYSICAL_PAGE_PERMISSION["name"],
                "module": PHYSICAL_PAGE_PERMISSION["module"],
                "description": PHYSICAL_PAGE_PERMISSION["description"],
                "created_at": now,
                "updated_at": now,
            },
        )
        # Grant initially to owner, admin, and employee roles when first created
        for role_code in ["owner", "admin", "employee"]:
            role_row = conn.execute(
                sa.text("SELECT id FROM roles WHERE code = :code"),
                {"code": role_code},
            ).first()
            if role_row:
                role_id = role_row[0]
                already_assigned = conn.execute(
                    sa.text("""
                        SELECT 1 FROM role_permissions
                        WHERE role_id = :role_id AND permission_id = :perm_id
                    """),
                    {"role_id": role_id, "perm_id": perm_id},
                ).first()
                if not already_assigned:
                    conn.execute(
                        sa.text("""
                            INSERT INTO role_permissions (role_id, permission_id)
                            VALUES (:role_id, :perm_id)
                        """),
                        {"role_id": role_id, "perm_id": perm_id},
                    )
    else:
        conn.execute(
            sa.text("""
                UPDATE permissions
                SET name = :name, module = :module, description = :description, updated_at = :updated_at
                WHERE code = :code
            """),
            {
                "code": PHYSICAL_PAGE_PERMISSION["code"],
                "name": PHYSICAL_PAGE_PERMISSION["name"],
                "module": PHYSICAL_PAGE_PERMISSION["module"],
                "description": PHYSICAL_PAGE_PERMISSION["description"],
                "updated_at": now,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()

    perm_row = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {"code": PHYSICAL_PAGE_PERMISSION["code"]},
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
