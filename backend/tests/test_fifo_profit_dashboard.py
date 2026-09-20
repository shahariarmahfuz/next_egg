import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import create_app
from app.db.session import AsyncSessionLocal, engine
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.inventory_batch import InventoryBatch
from app.models.sale import SaleItem

app = create_app()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_db_connections():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def auth_headers(async_client):
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "Owner@Argon2Secure2026!"},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_entities():
    unique_suffix = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        customer = Customer(
            customer_code=f"CUST-FIFO-{unique_suffix}",
            name=f"FIFO Test Customer {unique_suffix}",
            opening_balance=0.0,
            current_balance=0.0,
            advance_balance=0.0,
            credit_limit=1000000.0,
            status="active",
        )
        supplier = Supplier(
            supplier_code=f"SUPP-FIFO-{unique_suffix}",
            name=f"FIFO Test Supplier {unique_suffix}",
            opening_balance=0.0,
            current_balance=0.0,
            status="active",
        )
        product = Product(
            product_code=f"EGG-FIFO-{unique_suffix}",
            name=f"FIFO Test Egg {unique_suffix}",
            unit="pcs",
            selling_price=15.0,
            current_stock=0.0,
            opening_stock=0.0,
            opening_stock_unit_cost=10.0,
            minimum_stock=10.0,
            status="active",
        )
        db.add(customer)
        db.add(supplier)
        db.add(product)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(supplier)
        await db.refresh(product)
        return {"customer": customer, "supplier": supplier, "product": product}


@pytest.mark.asyncio
async def test_fifo_profit_exact_sequence_and_dashboard(async_client, auth_headers, test_entities):
    """
    Mandatory controlled test sequence:
    1. Product: Egg
    2. Purchase 1: 100 eggs @ 10 = 1,000
    3. Purchase 2: 100 eggs @ 11 = 1,100
    4. Purchase 3: 100 eggs @ 11.50 = 1,150
    Total inventory = 300 eggs

    5. Sale:
    Sell 150 eggs @ 15 = 2,250
    Expected FIFO COGS:
    100 from Purchase 1 @ 10 = 1,000
    50 from Purchase 2 @ 11 = 550
    Total COGS = 1,550
    Expected Revenue: 2,250
    Expected Gross Profit: 2,250 - 1,550 = 700

    Remaining Stock:
    50 eggs @ 11 = 550
    100 eggs @ 11.50 = 1,150
    Total remaining = 150 eggs, valuation = 1,700

    6. Credit Sale:
    Sell 50 @ 16 = 800 (paid = 0, due = 800)
    COGS = 50 * 11 = 550
    Profit = 800 - 550 = 250 (identical whether paid or due)

    7. Purchase Deletion Guard:
    Attempting to delete Purchase 1 fails because items were sold.
    """
    product = test_entities["product"]
    supplier = test_entities["supplier"]
    customer = test_entities["customer"]

    # 1. Purchase 1: 100 eggs @ 10
    res_p1 = await async_client.post(
        "/api/v1/purchases",
        headers=auth_headers,
        json={
            "supplier_id": supplier.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 100,
                    "unit_price": 10.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 1000.0,
        },
    )
    assert res_p1.status_code == 201, f"Purchase 1 failed: {res_p1.text}"
    p1_data = res_p1.json()["data"]
    p1_id = p1_data["id"]

    # 2. Purchase 2: 100 eggs @ 11
    res_p2 = await async_client.post(
        "/api/v1/purchases",
        headers=auth_headers,
        json={
            "supplier_id": supplier.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 100,
                    "unit_price": 11.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 1100.0,
        },
    )
    assert res_p2.status_code == 201, f"Purchase 2 failed: {res_p2.text}"
    p2_data = res_p2.json()["data"]

    # 3. Purchase 3: 100 eggs @ 11.50
    res_p3 = await async_client.post(
        "/api/v1/purchases",
        headers=auth_headers,
        json={
            "supplier_id": supplier.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 100,
                    "unit_price": 11.50,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 1150.0,
        },
    )
    assert res_p3.status_code == 201, f"Purchase 3 failed: {res_p3.text}"
    p3_data = res_p3.json()["data"]

    # Verify inventory batches in database
    async with AsyncSessionLocal() as db:
        batches_q = (
            select(InventoryBatch)
            .where(InventoryBatch.product_id == product.id)
            .order_by(InventoryBatch.purchase_date.asc())
        )
        batches = (await db.execute(batches_q)).scalars().all()
        assert len(batches) == 3
        assert batches[0].quantity == 100 and batches[0].remaining_quantity == 100 and batches[0].unit_cost == 10.0
        assert batches[1].quantity == 100 and batches[1].remaining_quantity == 100 and batches[1].unit_cost == 11.0
        assert batches[2].quantity == 100 and batches[2].remaining_quantity == 100 and batches[2].unit_cost == 11.50

    # 5. Sale 1: Sell 150 eggs @ 15 = 2,250 (cash sale)
    res_s1 = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 150,
                    "unit_price": 15.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 2250.0,
        },
    )
    assert res_s1.status_code == 201, f"Sale 1 failed: {res_s1.text}"
    s1_data = res_s1.json()["data"]

    # Verify Sale Item COGS
    async with AsyncSessionLocal() as db:
        si_q = select(SaleItem).where(SaleItem.sale_id == s1_data["id"])
        sale_item = (await db.execute(si_q)).scalar_one()
        # COGS must be 100 * 10 + 50 * 11 = 1,550
        assert sale_item.cogs == 1550.0
        # Gross profit = 2250 - 1550 = 700
        gross_profit = sale_item.total_price - sale_item.cogs
        assert gross_profit == 700.0

        # Verify remaining quantities in batches
        batches = (await db.execute(batches_q)).scalars().all()
        assert batches[0].remaining_quantity == 0.0  # Batch 1 fully consumed
        assert batches[1].remaining_quantity == 50.0  # Batch 2 half consumed
        assert batches[2].remaining_quantity == 100.0  # Batch 3 untouched

        # Inventory valuation of remaining stock = 50 * 11 + 100 * 11.50 = 550 + 1150 = 1700
        val = sum(b.remaining_quantity * b.unit_cost for b in batches)
        assert val == 1700.0

    # 6. Credit Sale: Sell 50 @ 16 = 800 (paid = 0, due = 800)
    res_s2 = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 50,
                    "unit_price": 16.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 0.0,  # 100% credit sale
        },
    )
    assert res_s2.status_code == 201, f"Sale 2 failed: {res_s2.text}"
    s2_data = res_s2.json()["data"]
    assert s2_data["due_amount"] == 800.0
    assert s2_data["paid_amount"] == 0.0

    async with AsyncSessionLocal() as db:
        si_q2 = select(SaleItem).where(SaleItem.sale_id == s2_data["id"])
        sale_item_2 = (await db.execute(si_q2)).scalar_one()
        # COGS must be the remaining 50 from Batch 2 @ 11 = 550
        assert sale_item_2.cogs == 550.0
        # Profit = 800 - 550 = 250
        gross_profit_2 = sale_item_2.total_price - sale_item_2.cogs
        assert gross_profit_2 == 250.0

    # 7. Test Purchase Deletion Guard:
    # Attempting to delete Purchase 1 must be rejected with 400 because items were already consumed in Sale 1
    res_del_p1 = await async_client.delete(
        f"/api/v1/purchases/{p1_id}",
        headers=auth_headers,
    )
    assert res_del_p1.status_code == 400
    assert "already been sold" in res_del_p1.text or "already been consumed" in res_del_p1.text

    # 8. Test Dashboard Summary endpoint:
    res_dash = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=auth_headers,
    )
    assert res_dash.status_code == 200
    dash_data = res_dash.json()["data"]
    # Total sales today must include both Sale 1 (2250) and Sale 2 (800) = at least 3050
    assert dash_data["total_sales"] >= 3050.0
    # Paid sales + Due sales on the test's sales equal Grand Total
    assert round(s1_data["paid_amount"] + s1_data["due_amount"], 2) == round(s1_data["grand_total"], 2)
    assert round(s2_data["paid_amount"] + s2_data["due_amount"], 2) == round(s2_data["grand_total"], 2)
    # Total COGS must include 1550 + 550 = 2100
    assert dash_data["total_cogs"] >= 2100.0


@pytest.mark.asyncio
async def test_distinct_due_sales_rule_and_returns(async_client, auth_headers):
    """
    Test the user's explicit rule:
    Sale A: 1000, paid 1000, due 0
    Sale B: 2000, paid 500, due 1500
    Sale C: 500, paid 0, due 500
    Then for today:
    Total Sales = 3500
    Paid / Cash Sales = 1500
    Due Sales = 2000
    Do not mix historical customer outstanding balance into Today's Due Sales.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        customer = Customer(
            customer_code=f"CUST-DUE-{unique_suffix}",
            name=f"Due Test Customer {unique_suffix}",
            opening_balance=50000.0,  # Large historical balance
            current_balance=50000.0,
            advance_balance=0.0,
            credit_limit=1000000.0,
            status="active",
        )
        product = Product(
            product_code=f"EGG-DUE-{unique_suffix}",
            name=f"Due Test Egg {unique_suffix}",
            unit="pcs",
            selling_price=10.0,
            current_stock=10000.0,
            opening_stock=10000.0,
            opening_stock_unit_cost=8.0,
            minimum_stock=10.0,
            status="active",
        )
        db.add(customer)
        db.add(product)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(product)

    # Baseline dashboard before this test's sales
    res_base = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=auth_headers,
    )
    assert res_base.status_code == 200
    base_dash = res_base.json()["data"]

    # Sale A: 1000, paid 1000, due 0 (100 pcs @ 10)
    res_a = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "items": [{"product_id": product.id, "quantity": 100, "unit_price": 10.0, "pricing_mode": "unit_price"}],
            "paid_amount": 1000.0,
        },
    )
    assert res_a.status_code == 201
    sale_a = res_a.json()["data"]
    assert sale_a["grand_total"] == 1000.0
    assert sale_a["paid_amount"] == 1000.0
    assert sale_a["due_amount"] == 0.0

    # Sale B: 2000, paid 500, due 1500 (200 pcs @ 10)
    res_b = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "items": [{"product_id": product.id, "quantity": 200, "unit_price": 10.0, "pricing_mode": "unit_price"}],
            "paid_amount": 500.0,
        },
    )
    assert res_b.status_code == 201
    sale_b = res_b.json()["data"]
    assert sale_b["grand_total"] == 2000.0
    assert sale_b["paid_amount"] == 500.0
    assert sale_b["due_amount"] == 1500.0

    # Sale C: 500, paid 0, due 500 (50 pcs @ 10)
    res_c = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "items": [{"product_id": product.id, "quantity": 50, "unit_price": 10.0, "pricing_mode": "unit_price"}],
            "paid_amount": 0.0,
        },
    )
    assert res_c.status_code == 201
    sale_c = res_c.json()["data"]
    assert sale_c["grand_total"] == 500.0
    assert sale_c["paid_amount"] == 0.0
    assert sale_c["due_amount"] == 500.0

    # Total Sales = 1000 + 2000 + 500 = 3500
    # Paid / Cash Sales = 1000 + 500 + 0 = 1500
    # Due Sales = 0 + 1500 + 500 = 2000
    res_dash = await async_client.get(
        "/api/v1/dashboard/summary",
        headers=auth_headers,
    )
    assert res_dash.status_code == 200
    dash_data = res_dash.json()["data"]

    # Verify deltas match exactly
    delta_sales = round(dash_data["total_sales"] - base_dash["total_sales"], 2)
    delta_cash = round(dash_data["total_cash_sales"] - base_dash["total_cash_sales"], 2)
    delta_due = round(dash_data["total_due_sales"] - base_dash["total_due_sales"], 2)

    assert delta_sales == 3500.0
    assert delta_cash == 1500.0
    assert delta_due == 2000.0

    # Customer had 50,000 historical balance, but delta due is strictly 2000.0!
    assert delta_due < 50000.0
    assert delta_sales == round(delta_cash + delta_due, 2)

    # Test Sale Return batch restoration:
    # Return 25 pcs from Sale C (which was 50 pcs @ 10)
    res_ret = await async_client.post(
        "/api/v1/sale-returns",
        headers=auth_headers,
        json={
            "customer_id": customer.id,
            "sale_id": sale_c["id"],
            "refund_amount": 0.0,
            "items": [
                {
                    "product_id": product.id,
                    "quantity": 25,
                    "unit_price": 10.0,
                }
            ],
            "notes": "Testing return batch restoration",
        },
    )
    assert res_ret.status_code == 201, f"Return failed: {res_ret.text}"

    # Verify stock increased by 25
    async with AsyncSessionLocal() as db:
        p_ref = await db.get(Product, product.id)
        # Originally 10,000 - 100 - 200 - 50 + 25 = 9675
        assert p_ref.current_stock == 9675.0
