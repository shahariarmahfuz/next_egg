import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from app.main import app
from app.models.customer import Customer
from app.models.product import Product
from app.models.user import User
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from sqlalchemy import select


@pytest.mark.asyncio
async def test_stock_report_endpoint():
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(
            select(User).join(User.role).where(User.status == "active")
        )
        user = user_res.scalars().first()
        assert user is not None, "Active user required for auth test"

        prod_res = await session.execute(
            select(Product).where(Product.product_code == "PROD-TEST-4f8c8680")
        )
        product = prod_res.scalars().first()
        if not product:
            prod_res = await session.execute(select(Product))
            product = prod_res.scalars().first()
        assert product is not None, "Product required for stock report test"

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Clear customer setting first to test base scenario
        await client.put(
            "/api/v1/settings/stock-report-customer",
            json={"customer_id": None},
            headers=headers,
        )

        # 1. Valid request without configured customer
        response = await client.get(
            f"/api/v1/reports/stock?product_id={product.id}&target_date=2026-09-20",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["success"] is True
        report = data["data"]
        assert report["product"]["id"] == product.id
        assert report["target_date"] == "2026-09-20"
        assert "opening_stock" in report
        assert "previous_stock" in report
        assert "purchases" in report
        assert "sales" in report
        assert "cash_sales" in report
        assert "due_sales" in report
        assert "remaining_stock" in report
        assert report["configured_customer"] is None
        assert report["customer_sales"] == 0.0

        # Check cash + due sales equals total sales
        assert abs((report["cash_sales"] + report["due_sales"]) - report["sales"]) < 0.001

        # Check closing stock identity
        expected_remaining = (
            report["opening_stock"]
            + report["purchases"]
            - report["purchase_returns"]
            - report["sales"]
            + report["sale_returns"]
        )
        assert abs(report["remaining_stock"] - expected_remaining) < 0.001

        # 2. Non-existent product ID
        bad_response = await client.get(
            "/api/v1/reports/stock?product_id=00000000-0000-0000-0000-000000000000&target_date=2026-09-20",
            headers=headers,
        )
        assert bad_response.status_code == 404

        # 3. Invalid date format
        bad_date_response = await client.get(
            f"/api/v1/reports/stock?product_id={product.id}&target_date=invalid-date",
            headers=headers,
        )
        assert bad_date_response.status_code == 400


@pytest.mark.asyncio
async def test_stock_report_customer_setting_and_separation():
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(
            select(User).join(User.role).where(User.status == "active")
        )
        user = user_res.scalars().first()
        assert user is not None

        # Customer with known sale: Precision Test Customer 4f8c8680
        cust_res = await session.execute(
            select(Customer).where(Customer.customer_code == "CUST-TEST-4f8c8680")
        )
        customer = cust_res.scalars().first()
        assert customer is not None

        prod_res = await session.execute(
            select(Product).where(Product.product_code == "PROD-TEST-4f8c8680")
        )
        product = prod_res.scalars().first()
        assert product is not None

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Update setting to configure this customer
        put_res = await client.put(
            "/api/v1/settings/stock-report-customer",
            json={"customer_id": customer.id},
            headers=headers,
        )
        assert put_res.status_code == 200, put_res.text
        assert put_res.json()["data"]["customer_id"] == customer.id

        # 2. Verify setting retrieval
        get_res = await client.get(
            "/api/v1/settings/stock-report-customer",
            headers=headers,
        )
        assert get_res.status_code == 200
        assert get_res.json()["data"]["customer_id"] == customer.id
        assert get_res.json()["data"]["customer"]["name"] == customer.name

        # 3. Request Stock Report for date 2026-09-20 (date of customer sale)
        report_res = await client.get(
            f"/api/v1/reports/stock?product_id={product.id}&target_date=2026-09-20",
            headers=headers,
        )
        assert report_res.status_code == 200
        report = report_res.json()["data"]

        # Configured customer info must be populated
        assert report["configured_customer"] is not None
        assert report["configured_customer"]["id"] == customer.id
        assert report["configured_customer"]["name"] == customer.name

        # Customer sales must reflect customer's purchase quantity (1989.0)
        assert report["customer_sales"] == 1989.0

        # Customer sales must NOT be included in cash_sales or due_sales
        assert report["cash_sales"] == 0.0
        assert report["due_sales"] == 0.0

        # Total sales must equal customer_sales + cash_sales + due_sales
        assert abs(report["sales"] - (report["customer_sales"] + report["cash_sales"] + report["due_sales"])) < 0.001

        # Remaining stock must be correctly reduced (10000 - 1989 = 8011)
        assert report["remaining_stock"] == 8011.0

        # 4. Clean up / clear customer configuration
        clear_res = await client.put(
            "/api/v1/settings/stock-report-customer",
            json={"customer_id": None},
            headers=headers,
        )
        assert clear_res.status_code == 200
        assert clear_res.json()["data"]["customer_id"] is None


@pytest.mark.asyncio
async def test_stock_report_rbac_permission():
    from app.models.role import Role

    async with AsyncSessionLocal() as session:
        prod_res = await session.execute(select(Product))
        product = prod_res.scalars().first()
        assert product is not None

        owner_res = await session.execute(
            select(User).join(User.role).where(Role.code == "owner", User.status == "active")
        )
        owner_user = owner_res.scalars().first()
        assert owner_user is not None

        emp_res = await session.execute(
            select(User).join(User.role).where(Role.code == "employee", User.status == "active")
        )
        emp_user = emp_res.scalars().first()

    # 1. Owner has full access and succeeds (200)
    owner_token = create_access_token(subject=owner_user.id)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.get(
            f"/api/v1/reports/stock?product_id={product.id}&target_date=2026-09-20",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert res.status_code == 200

        # 2. Employee without stock_report.view must be rejected with 403 Forbidden
        if emp_user:
            emp_token = create_access_token(subject=emp_user.id)
            emp_res = await client.get(
                f"/api/v1/reports/stock?product_id={product.id}&target_date=2026-09-20",
                headers={"Authorization": f"Bearer {emp_token}"},
            )
            assert emp_res.status_code == 403, f"Expected 403 but got {emp_res.status_code}: {emp_res.text}"


@pytest.mark.asyncio
async def test_zero_stock_product_has_no_phantom_stock():
    """
    Verifies that when a product's current live stock is 0.0 and no transactions
    occurred today, both Previous Stock and Remaining Stock are 0.0 (no phantom stock drift).
    """
    import uuid
    from datetime import date
    from app.models.role import Role

    async with AsyncSessionLocal() as session:
        user_res = await session.execute(
            select(User).join(User.role).where(Role.code.in_(["owner", "admin"]), User.status == "active")
        )
        user = user_res.scalars().first()
        if not user:
            user_res = await session.execute(select(User).where(User.status == "active"))
            user = user_res.scalars().first()
        assert user is not None

        unique_suffix = uuid.uuid4().hex[:8]
        zero_prod = Product(
            product_code=f"PROD-ZERO-{unique_suffix}",
            name=f"Zero Stock Product {unique_suffix}",
            unit="pcs",
            opening_stock=0.0,
            current_stock=0.0,
            opening_stock_unit_cost=0.0,
            selling_price=10.0,
            minimum_stock=0.0,
            status="active",
        )
        session.add(zero_prod)
        await session.commit()
        await session.refresh(zero_prod)
        prod_id = zero_prod.id

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}
    today_str = date.today().strftime("%Y-%m-%d")

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            f"/api/v1/reports/stock?product_id={prod_id}&target_date={today_str}",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["success"] is True
        report = data["data"]

        # Current stock must be 0.0
        assert report["product"]["current_stock"] == 0.0
        # Opening/Previous stock must be exactly 0.0 (no phantom opening stock)
        assert report["opening_stock"] == 0.0
        assert report["previous_stock"] == 0.0
        # No movements today
        assert report["purchases"] == 0.0
        assert report["sales"] == 0.0
        # Remaining stock must be 0.0
        assert report["remaining_stock"] == 0.0
        # Balancing equation: previous_stock + purchases - sales = remaining_stock
        assert report["previous_stock"] + report["purchases"] - report["sales"] == report["remaining_stock"]


