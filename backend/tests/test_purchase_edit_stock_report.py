import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
import uuid
from app.main import app
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.user import User
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from sqlalchemy import select


@pytest.mark.asyncio
async def test_purchase_edit_daily_stock_report_complete_scenario():
    """
    Test scenario:
    1. Create a purchase for a product on a specific past date (2026-10-20) with quantity 500.
    2. Edit that purchase (change quantity to 600 without changing the date).
    3. Query the Daily Stock Report for 2026-10-20.
    4. Verify that Purchases on 2026-10-20 shows +600 (NOT +0), and Previous Stock / Remaining Stock match.
    """
    async with AsyncSessionLocal() as session:
        user_res = await session.execute(
            select(User).join(User.role).where(User.status == "active")
        )
        user = user_res.scalars().first()
        assert user is not None, "Active user required for auth test"

        sup_res = await session.execute(select(Supplier))
        supplier = sup_res.scalars().first()
        if not supplier:
            supplier = Supplier(
                name="Test Supplier Stock Report",
                supplier_code=f"SUP-{uuid.uuid4().hex[:6]}",
                contact_person="Tester",
                phone="01700000000",
            )
            session.add(supplier)
            await session.commit()
            await session.refresh(supplier)

        # Create a dedicated product for this isolated test
        product = Product(
            name=f"Stock Report Test Product {uuid.uuid4().hex[:6]}",
            product_code=f"PROD-TEST-{uuid.uuid4().hex[:6]}",
            unit="pcs",
            opening_stock_unit_cost=10.0,
            selling_price=20.0,
            current_stock=0.0,
            status="active",
            product_type="NORMAL",
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)
        product_id = product.id
        supplier_id = supplier.id

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Create a purchase on past date 2026-10-20 with quantity 500
        purchase_payload = {
            "supplier_id": supplier_id,
            "purchase_date": "2026-10-20T12:00:00.000Z",
            "items": [
                {
                    "product_id": product_id,
                    "quantity": 500.0,
                    "unit_price": 10.0,
                    "discount": 0.0,
                    "total_price": 5000.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "discount_amount": 0.0,
            "tax_amount": 0.0,
            "paid_amount": 5000.0,
            "notes": "Initial purchase of 500 units",
        }

        create_res = await client.post(
            "/api/v1/purchases",
            json=purchase_payload,
            headers=headers,
        )
        assert create_res.status_code == 201, create_res.text
        created_purchase = create_res.json()["data"]
        purchase_id = created_purchase["id"]

        # Verify initial stock report before edit
        report_res = await client.get(
            f"/api/v1/reports/stock?product_id={product_id}&target_date=2026-10-20&timezone=UTC",
            headers=headers,
        )
        assert report_res.status_code == 200, report_res.text
        report_data = report_res.json()["data"]
        assert report_data["purchases"] == 500.0
        assert report_data["previous_stock"] == 0.0
        assert report_data["remaining_stock"] == 500.0

        # 2. Edit that purchase (change quantity to 600, preserving original calendar date 2026-10-20)
        update_payload = {
            "supplier_id": supplier_id,
            "purchase_date": "2026-10-20T12:00:00.000Z",
            "items": [
                {
                    "product_id": product_id,
                    "quantity": 600.0,
                    "unit_price": 10.0,
                    "discount": 0.0,
                    "total_price": 6000.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "discount_amount": 0.0,
            "tax_amount": 0.0,
            "paid_amount": 6000.0,
            "notes": "Updated purchase to 600 units",
        }

        update_res = await client.put(
            f"/api/v1/purchases/{purchase_id}",
            json=update_payload,
            headers=headers,
        )
        assert update_res.status_code == 200, update_res.text

        # 3. Query Daily Stock Report for 2026-10-20 with UTC
        report_res_utc = await client.get(
            f"/api/v1/reports/stock?product_id={product_id}&target_date=2026-10-20&timezone=UTC",
            headers=headers,
        )
        assert report_res_utc.status_code == 200, report_res_utc.text
        report_utc = report_res_utc.json()["data"]

        # 4. Verify Purchases on 2026-10-20 shows +600 (NOT +0)
        assert report_utc["purchases"] == 600.0, f"Expected 600.0, got {report_utc['purchases']}"
        assert report_utc["previous_stock"] == 0.0
        assert report_utc["remaining_stock"] == 600.0
        assert abs(report_utc["previous_stock"] + report_utc["purchases"] - report_utc["remaining_stock"]) < 0.001

        # Also query with Asia/Dhaka timezone to ensure timezone preservation works across boundaries
        report_res_dhaka = await client.get(
            f"/api/v1/reports/stock?product_id={product_id}&target_date=2026-10-20&timezone=Asia/Dhaka",
            headers=headers,
        )
        assert report_res_dhaka.status_code == 200, report_res_dhaka.text
        report_dhaka = report_res_dhaka.json()["data"]
        assert report_dhaka["purchases"] == 600.0, f"Expected 600.0 in Asia/Dhaka, got {report_dhaka['purchases']}"
        assert report_dhaka["previous_stock"] == 0.0
        assert report_dhaka["remaining_stock"] == 600.0

        # Verify product current_stock in database is 600
        async with AsyncSessionLocal() as session:
            p_check = await session.get(Product, product_id)
            assert p_check.current_stock == 600.0

            # Clean up test purchase and product
            await client.delete(f"/api/v1/purchases/{purchase_id}", headers=headers)
            await session.delete(p_check)
            await session.commit()
