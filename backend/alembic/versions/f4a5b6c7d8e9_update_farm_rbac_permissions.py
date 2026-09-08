"""update_farm_rbac_permissions

Revision ID: f4a5b6c7d8e9
Revises: e2b3c4d5e6f7
Create Date: 2026-09-08 11:30:00.000000

"""
from typing import Sequence, Union
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FARM_PERMISSIONS = [
    # Farm
    {"code": "farm.view", "name": "View Farm", "module": "farm", "description": "Access farm management and view tray balances"},
    {"code": "farm.create", "name": "Create Farm", "module": "farm", "description": "Add new farm locations and configure previous trays"},
    {"code": "farm.edit", "name": "Edit Farm", "module": "farm", "description": "Modify farm details and opening tray balances"},
    {"code": "farm.delete", "name": "Delete Farm", "module": "farm", "description": "Remove farm locations and associated records"},
    # Production
    {"code": "farm.production.view", "name": "View Production", "module": "farm", "description": "View farm production history and batches"},
    {"code": "farm.production.create", "name": "Add Production", "module": "farm", "description": "Record daily production harvest in trays"},
    {"code": "farm.production.edit", "name": "Edit Production", "module": "farm", "description": "Modify recorded production batches"},
    {"code": "farm.production.delete", "name": "Delete Production", "module": "farm", "description": "Delete production harvest records"},
    # Delivery
    {"code": "farm.delivery.view", "name": "View Delivery", "module": "farm", "description": "View farm delivery dispatches and history"},
    {"code": "farm.delivery.create", "name": "Add Delivery", "module": "farm", "description": "Record multi-destination delivery submissions"},
    {"code": "farm.delivery.edit", "name": "Edit Delivery", "module": "farm", "description": "Modify recorded delivery dispatches"},
    {"code": "farm.delivery.delete", "name": "Delete Delivery", "module": "farm", "description": "Delete delivery dispatch records"},
    # Reports
    {"code": "farm.report", "name": "View Farm Reports", "module": "farm", "description": "View date-wise production and delivery breakdown reports"},
]

OBSOLETE_PERM_CODES = [
    "farm.waste",
    "farm.manage",
    "farm.production",  # old broad permission
    "farm.delivery",    # old broad permission
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Clean up obsolete permissions from role_permissions and permissions
    obsolete_codes_str = ", ".join(f"'{c}'" for c in OBSOLETE_PERM_CODES)
    conn.execute(sa.text(f"""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions WHERE code IN ({obsolete_codes_str})
        );
    """))
    conn.execute(sa.text(f"""
        DELETE FROM permissions
        WHERE code IN ({obsolete_codes_str});
    """))

    # 2. Insert or update the 13 official farm permissions
    now = datetime.now(timezone.utc)
    for perm in FARM_PERMISSIONS:
        existing = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]}
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
                    "code": perm["code"],
                    "name": perm["name"],
                    "module": perm["module"],
                    "description": perm["description"],
                    "created_at": now,
                    "updated_at": now,
                }
            )
        else:
            conn.execute(
                sa.text("""
                    UPDATE permissions
                    SET name = :name, module = :module, description = :description, updated_at = :updated_at
                    WHERE code = :code
                """),
                {
                    "code": perm["code"],
                    "name": perm["name"],
                    "module": perm["module"],
                    "description": perm["description"],
                    "updated_at": now,
                }
            )

    # 3. Configure Role Permissions:
    # Admin gets operational & edit permissions, but NOT delete permissions:
    # NO farm.delete, NO farm.production.delete, NO farm.delivery.delete
    admin_codes = [
        "farm.view",
        "farm.create",
        "farm.edit",
        "farm.production.view",
        "farm.production.create",
        "farm.production.edit",
        "farm.delivery.view",
        "farm.delivery.create",
        "farm.delivery.edit",
        "farm.report",
    ]

    # Employee gets view & create permissions only (no edit, no delete)
    employee_codes = [
        "farm.view",
        "farm.create",
        "farm.production.view",
        "farm.production.create",
        "farm.delivery.view",
        "farm.delivery.create",
        "farm.report",
    ]

    # Owner gets all 13 permissions
    owner_codes = [p["code"] for p in FARM_PERMISSIONS]

    role_map = {
        "admin": admin_codes,
        "employee": employee_codes,
        "owner": owner_codes,
    }

    for role_code, target_perm_codes in role_map.items():
        role_row = conn.execute(
            sa.text("SELECT id FROM roles WHERE code = :code"),
            {"code": role_code}
        ).first()

        if not role_row:
            continue

        role_id = role_row[0]

        # Fetch permission IDs for target codes
        codes_str = ", ".join(f"'{c}'" for c in target_perm_codes)
        perm_rows = conn.execute(
            sa.text(f"SELECT id FROM permissions WHERE code IN ({codes_str})")
        ).fetchall()

        for p_row in perm_rows:
            p_id = p_row[0]
            existing_rp = conn.execute(
                sa.text("SELECT 1 FROM role_permissions WHERE role_id = :role_id AND permission_id = :perm_id"),
                {"role_id": role_id, "perm_id": p_id}
            ).first()
            if not existing_rp:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:role_id, :perm_id)"),
                    {"role_id": role_id, "perm_id": p_id}
                )


def downgrade() -> None:
    pass
