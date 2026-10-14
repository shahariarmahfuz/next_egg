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
