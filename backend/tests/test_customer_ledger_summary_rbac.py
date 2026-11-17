import uuid
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.main import create_app
from app.models.base import Base
from app.models.customer import Customer
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User


@pytest_asyncio.fixture
async def ledger_rbac_env():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as db:
        perm_codes = [
            ("customer.view", "customer"),
            ("customer.ledger.summary.view", "customer"),
            ("role.view", "role"),
            ("role.edit", "role"),
        ]
        perms = {}
        for code, mod in perm_codes:
            p = Permission(
                id=str(uuid.uuid4()),
                code=code,
                name=code,
                module=mod,
                description=code,
            )
            db.add(p)
            perms[code] = p

        owner_role = Role(
            id=str(uuid.uuid4()),
            name="Owner",
            code="owner",
            is_system=True,
            permissions=list(perms.values()),
        )
        admin_role = Role(
            id=str(uuid.uuid4()),
            name="Admin",
            code="admin",
            is_system=True,
            permissions=[perms["customer.view"], perms["role.view"], perms["role.edit"]],
        )
        employee_role = Role(
            id=str(uuid.uuid4()),
            name="Employee",
            code="employee",
            is_system=True,
            permissions=[perms["customer.view"]],
        )
        db.add_all([owner_role, admin_role, employee_role])
        await db.flush()

        owner_user = User(
            id=str(uuid.uuid4()),
            username="owner",
            email="owner@test.com",
            password_hash="hash",
            full_name="Owner User",
            role_id=owner_role.id,
            status="active",
        )
        admin_user = User(
            id=str(uuid.uuid4()),
            username="admin",
            email="admin@test.com",
            password_hash="hash",
            full_name="Admin User",
            role_id=admin_role.id,
            status="active",
        )
        employee_user = User(
            id=str(uuid.uuid4()),
            username="employee",
            email="employee@test.com",
            password_hash="hash",
            full_name="Employee User",
            role_id=employee_role.id,
            status="active",
        )
        customer = Customer(
            id=str(uuid.uuid4()),
            customer_code="CUST-00001",
            name="Ledger RBAC Customer",
            opening_balance=50000.0,
            current_balance=46220.0,
            physical_page_number="55",
            status="active",
        )
        db.add_all([owner_user, admin_user, employee_user, customer])
        await db.commit()

    app = create_app()
    current_actor = {"user": owner_user}

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def override_get_current_user():
        async with session_factory() as session:
            res = await session.execute(
                select(User)
                .options(selectinload(User.role).selectinload(Role.permissions))
                .where(User.id == current_actor["user"].id)
            )
            return res.scalars().first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield {
            "client": client,
            "actor": current_actor,
            "owner": owner_user,
            "admin": admin_user,
            "employee": employee_user,
            "admin_role": admin_role,
            "employee_role": employee_role,
            "customer": customer,
            "perms": perms,
        }

    await engine.dispose()


@pytest.mark.asyncio
async def test_ledger_summary_cards_owner_only_and_owner_delegatable(ledger_rbac_env):
    client = ledger_rbac_env["client"]
    actor = ledger_rbac_env["actor"]
    owner = ledger_rbac_env["owner"]
    admin = ledger_rbac_env["admin"]
    employee = ledger_rbac_env["employee"]
    admin_role = ledger_rbac_env["admin_role"]
    employee_role = ledger_rbac_env["employee_role"]
    customer = ledger_rbac_env["customer"]
    perms = ledger_rbac_env["perms"]

    # 1. Owner sees full summary cards data + current_balance + transactions
    actor["user"] = owner
    owner_res = await client.get(f"/api/v1/customers/{customer.id}/ledger")
    assert owner_res.status_code == 200, owner_res.text
    owner_data = owner_res.json()["data"]
    assert owner_data["summary"] is not None
    assert owner_data["summary"]["opening_balance"] == 50000.0
    assert owner_data["summary"]["current_due"] == 46220.0
    assert owner_data["customer"]["current_balance"] == 46220.0
    assert owner_data["customer"]["physical_page_number"] == "55"

    # 2. Admin without permission gets summary=None, but still sees customer.current_balance & transactions
    actor["user"] = admin
    admin_res = await client.get(f"/api/v1/customers/{customer.id}/ledger")
    assert admin_res.status_code == 200, admin_res.text
    admin_data = admin_res.json()["data"]
    assert admin_data["summary"] is None
    assert admin_data["customer"]["current_balance"] == 46220.0
    assert len(admin_data["transactions"]) == 1

    # 3. Employee without permission also gets summary=None
    actor["user"] = employee
    emp_res = await client.get(f"/api/v1/customers/{customer.id}/ledger")
    assert emp_res.status_code == 200, emp_res.text
    assert emp_res.json()["data"]["summary"] is None
    assert emp_res.json()["data"]["customer"]["current_balance"] == 46220.0

    # 4. Admin with role.edit CANNOT grant customer.ledger.summary.view to Admin or Employee
    actor["user"] = admin
    self_grant = await client.put(
        f"/api/v1/roles/{admin_role.id}/permissions",
        json={
            "permission_ids": [
                perms["customer.view"].id,
                perms["role.view"].id,
                perms["role.edit"].id,
                perms["customer.ledger.summary.view"].id,
            ]
        },
    )
    assert self_grant.status_code == 403

    create_with_owner_perm = await client.post(
        "/api/v1/roles",
        json={
            "name": "Sneaky Role",
            "code": "sneaky_role",
            "permission_ids": [perms["customer.ledger.summary.view"].id],
        },
    )
    assert create_with_owner_perm.status_code == 403

    # Admin CAN still update non-owner-only permissions on Employee
    admin_normal_update = await client.put(
        f"/api/v1/roles/{employee_role.id}/permissions",
        json={"permission_ids": [perms["customer.view"].id]},
    )
    assert admin_normal_update.status_code == 200

    # 5. Owner CAN grant customer.ledger.summary.view to Admin
    actor["user"] = owner
    owner_grant = await client.put(
        f"/api/v1/roles/{admin_role.id}/permissions",
        json={
            "permission_ids": [
                perms["customer.view"].id,
                perms["role.view"].id,
                perms["role.edit"].id,
                perms["customer.ledger.summary.view"].id,
            ]
        },
    )
    assert owner_grant.status_code == 200, owner_grant.text

    # 6. Now Admin receives full summary on /ledger
    actor["user"] = admin
    admin_res_after = await client.get(f"/api/v1/customers/{customer.id}/ledger")
    assert admin_res_after.status_code == 200
    assert admin_res_after.json()["data"]["summary"] is not None
    assert admin_res_after.json()["data"]["summary"]["current_due"] == 46220.0

    # 7. Admin CANNOT strip or alter Owner-granted permission; Owner CAN revoke it
    admin_keep_update = await client.put(
        f"/api/v1/roles/{admin_role.id}/permissions",
        json={
            "permission_ids": [
                perms["customer.view"].id,
                perms["role.view"].id,
                perms["role.edit"].id,
            ]
        },
    )
    assert admin_keep_update.status_code == 403

    actor["user"] = owner
    owner_revoke = await client.put(
        f"/api/v1/roles/{admin_role.id}/permissions",
        json={
            "permission_ids": [
                perms["customer.view"].id,
                perms["role.view"].id,
                perms["role.edit"].id,
            ]
        },
    )
    assert owner_revoke.status_code == 200

    actor["user"] = admin
    admin_res_revoked = await client.get(f"/api/v1/customers/{customer.id}/ledger")
    assert admin_res_revoked.status_code == 200
    assert admin_res_revoked.json()["data"]["summary"] is None
