import uuid
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.main import create_app
from app.models.base import Base
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User


@pytest_asyncio.fixture
async def isolated_env():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as db:
        perm_codes = [
            "customer.view",
            "customer.create",
            "customer.edit",
            "customer.due.view",
            "customer.physical_page.manage",
        ]
        perms = {}
        for code in perm_codes:
            p = Permission(
                id=str(uuid.uuid4()),
                code=code,
                name=code,
                module="customer",
                description=code,
            )
            db.add(p)
            perms[code] = p

        # Role 1: Full customer + physical page permissions
        full_role = Role(
            id=str(uuid.uuid4()),
            name="Customer Full",
            code="customer_full",
            is_system=False,
            permissions=[
                perms["customer.view"],
                perms["customer.create"],
                perms["customer.edit"],
                perms["customer.due.view"],
                perms["customer.physical_page.manage"],
            ],
        )
        # Role 2: Employee-like role (view + create + physical_page.manage, NO customer.edit)
        employee_like_role = Role(
            id=str(uuid.uuid4()),
            name="Employee With Page",
            code="employee_with_page",
            is_system=False,
            permissions=[
                perms["customer.view"],
                perms["customer.create"],
                perms["customer.physical_page.manage"],
            ],
        )
        # Role 3: Revoked physical page role (has customer.view + customer.edit, NO physical_page.manage)
        revoked_role = Role(
            id=str(uuid.uuid4()),
            name="Customer Edit No Page",
            code="customer_edit_no_page",
            is_system=False,
            permissions=[
                perms["customer.view"],
                perms["customer.edit"],
            ],
        )
        db.add_all([full_role, employee_like_role, revoked_role])
        await db.flush()

        full_user = User(
            id=str(uuid.uuid4()),
            username="full_user",
            email="full@test.com",
            password_hash="hash",
            full_name="Full User",
            role_id=full_role.id,
            status="active",
        )
        employee_user = User(
            id=str(uuid.uuid4()),
            username="emp_user",
            email="emp@test.com",
            password_hash="hash",
            full_name="Employee User",
            role_id=employee_like_role.id,
            status="active",
        )
        revoked_user = User(
            id=str(uuid.uuid4()),
            username="revoked_user",
            email="revoked@test.com",
            password_hash="hash",
            full_name="Revoked User",
            role_id=revoked_role.id,
            status="active",
        )
        db.add_all([full_user, employee_user, revoked_user])
        await db.commit()
        await db.refresh(full_user)
        await db.refresh(employee_user)
        await db.refresh(revoked_user)

    app = create_app()
    current_actor = {"user": full_user}

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
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            res = await session.execute(
                select(User)
                .options(selectinload(User.role).selectinload(Role.permissions))
                .where(User.id == current_actor["user"].id)
            )
            return res.scalars().first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, current_actor, full_user, employee_user, revoked_user

    await engine.dispose()


@pytest.mark.asyncio
async def test_physical_page_number_crud_duplicates_search_ledger_and_rbac(isolated_env):
    client, current_actor, full_user, employee_user, revoked_user = isolated_env

    # 1. Create customers: numeric, alphanumeric (with whitespace), and blank/omitted
    res1 = await client.post(
        "/api/v1/customers",
        json={"name": "Karim Traders", "physical_page_number": "  12  ", "opening_balance": 500},
    )
    assert res1.status_code == 201, res1.text
    c1 = res1.json()["data"]
    assert c1["physical_page_number"] == "12"

    res2 = await client.post(
        "/api/v1/customers",
        json={"name": "Rahim Poultry", "physical_page_number": "A-15/2"},
    )
    assert res2.status_code == 201, res2.text
    c2 = res2.json()["data"]
    assert c2["physical_page_number"] == "A-15/2"

    # Duplicate physical page number is allowed
    res3 = await client.post(
        "/api/v1/customers",
        json={"name": "Shared Page Customer", "physical_page_number": "A-15/2"},
    )
    assert res3.status_code == 201, res3.text
    c3 = res3.json()["data"]
    assert c3["physical_page_number"] == "A-15/2"

    # Blank physical page normalizes to None
    res4 = await client.post(
        "/api/v1/customers",
        json={"name": "Blank Page Customer", "physical_page_number": "   "},
    )
    assert res4.status_code == 201, res4.text
    c4 = res4.json()["data"]
    assert c4["physical_page_number"] is None

    # 2. Employee-like user (WITHOUT customer.edit, WITH customer.physical_page.manage) can set & remove page number
    current_actor["user"] = employee_user
    patch_set = await client.patch(
        f"/api/v1/customers/{c4['id']}/physical-page",
        json={"physical_page_number": "P-99"},
    )
    assert patch_set.status_code == 200, patch_set.text
    assert patch_set.json()["data"]["physical_page_number"] == "P-99"

    # 3. Full user tests PUT preservation and clear/integer coercion
    current_actor["user"] = full_user
    put_other = await client.put(
        f"/api/v1/customers/{c4['id']}",
        json={"name": "Blank Page Customer Updated"},
    )
    assert put_other.status_code == 200, put_other.text
    assert put_other.json()["data"]["physical_page_number"] == "P-99"

    patch_clear = await client.patch(
        f"/api/v1/customers/{c4['id']}/physical-page",
        json={"physical_page_number": "   "},
    )
    assert patch_clear.status_code == 200, patch_clear.text
    assert patch_clear.json()["data"]["physical_page_number"] is None

    patch_num = await client.patch(
        f"/api/v1/customers/{c4['id']}/physical-page",
        json={"physical_page_number": 45},
    )
    assert patch_num.status_code == 200, patch_num.text
    assert patch_num.json()["data"]["physical_page_number"] == "45"

    patch_null = await client.patch(
        f"/api/v1/customers/{c4['id']}/physical-page",
        json={"physical_page_number": None},
    )
    assert patch_null.status_code == 200, patch_null.text
    assert patch_null.json()["data"]["physical_page_number"] is None

    patch_missing = await client.patch(
        f"/api/v1/customers/{c4['id']}/physical-page",
        json={},
    )
    assert patch_missing.status_code == 422

    # 4. Revoked user (even WITH customer.edit, WITHOUT customer.physical_page.manage) gets 403 on PATCH and PUT-with-page
    current_actor["user"] = revoked_user
    forbidden_patch = await client.patch(
        f"/api/v1/customers/{c1['id']}/physical-page",
        json={"physical_page_number": "999"},
    )
    assert forbidden_patch.status_code == 403

    forbidden_put_with_page = await client.put(
        f"/api/v1/customers/{c1['id']}",
        json={"name": "Karim Traders", "physical_page_number": "999"},
    )
    assert forbidden_put_with_page.status_code == 403

    # Still allowed to update non-page customer fields via PUT
    allowed_put_without_page = await client.put(
        f"/api/v1/customers/{c1['id']}",
        json={"name": "Karim Traders Ltd"},
    )
    assert allowed_put_without_page.status_code == 200
    assert allowed_put_without_page.json()["data"]["physical_page_number"] == "12"

    # Restore full user
    current_actor["user"] = full_user

    # 5. Search by physical_page_number in directory and dues endpoints
    search_res = await client.get("/api/v1/customers", params={"search": "A-15/2"})
    assert search_res.status_code == 200
    found_ids = {item["id"] for item in search_res.json()["data"]["items"]}
    assert found_ids == {c2["id"], c3["id"]}

    dues_res = await client.get("/api/v1/customers/dues", params={"search": "12"})
    assert dues_res.status_code == 200
    assert [item["id"] for item in dues_res.json()["data"]["items"]] == [c1["id"]]

    dues_summary_res = await client.get("/api/v1/customers/dues/summary", params={"search": "12"})
    assert dues_summary_res.status_code == 200
    assert dues_summary_res.json()["data"]["total_customers"] == 1
    assert dues_summary_res.json()["data"]["total_amount"] == 500.0

    # 6. Customer ledger endpoint includes physical_page_number
    ledger_res = await client.get(f"/api/v1/customers/{c1['id']}/ledger")
    assert ledger_res.status_code == 200, ledger_res.text
    assert ledger_res.json()["data"]["customer"]["physical_page_number"] == "12"
