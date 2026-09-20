import random
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from httpx import AsyncClient

from app.db.session import AsyncSessionLocal
from app.models.customer import Customer
from app.models.expense import Expense, ExpenseCategory
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.sale import Sale
from app.services.dashboard_service import dashboard_service


@pytest.mark.asyncio
async def test_cash_out_complete_flow_twelve_checks(async_client: AsyncClient, auth_headers: dict):
    """
    Dedicated test for the 12 user-specified validation steps:
    1. Open Accounts -> Cash Out.
    2. Create Cash Out of 2,000.
    3. Verify it is saved.
    4. Verify it appears in Cash Book.
    5. Verify Cash Book balance decreases by 2,000.
    6. Verify it does NOT appear in Expenses.
    7. Verify Total Expense does NOT increase.
    8. Verify Profit does NOT decrease because of Cash Out.
    9. Verify it does not affect Customer Due.
    10. Verify it does not affect Supplier Due.
    11. Verify next day's Cash Book still starts from 0.
    12. Verify Cash Book print / summary includes the Cash Out transaction.
    """
    unique = uuid.uuid4().hex[:8]
    random_days = random.randint(25000, 50000)
    day1_base = date(2028, 1, 1) + timedelta(days=random_days)
    day2_base = day1_base + timedelta(days=1)

    day1_str = day1_base.strftime("%Y-%m-%d")
    day2_str = day2_base.strftime("%Y-%m-%d")

    day1_dt = datetime(day1_base.year, day1_base.month, day1_base.day, 12, 0, 0, tzinfo=timezone.utc)
    day2_dt = datetime(day2_base.year, day2_base.month, day2_base.day, 12, 0, 0, tzinfo=timezone.utc)

    async with AsyncSessionLocal() as db:
        customer = Customer(
            customer_code=f"CO-CUST-{unique}",
            name=f"Cash Out Customer {unique}",
            opening_balance=5000.0,
            current_balance=5000.0,
            status="active",
        )
        supplier = Supplier(
            supplier_code=f"CO-SUPP-{unique}",
            name=f"Cash Out Supplier {unique}",
            opening_balance=3000.0,
            current_balance=3000.0,
            status="active",
        )
        product = Product(
            product_code=f"CO-PROD-{unique}",
            name=f"Cash Out Product {unique}",
            unit="pcs",
            selling_price=100.0,
            current_stock=1000.0,
            opening_stock=1000.0,
            opening_stock_unit_cost=60.0,
            status="active",
        )
        category = ExpenseCategory(
            name=f"CO Category {unique}",
            status="active",
        )
        db.add_all([customer, supplier, product, category])
        await db.commit()
        await db.refresh(customer)
        await db.refresh(supplier)
        await db.refresh(product)
        await db.refresh(category)
        cust_id = customer.id
        supp_id = supplier.id
        prod_id = product.id
        cat_id = category.id

    # Base state: Create Sale of 10,000 cash and Expense of 1,000 cash
    res_sale = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": cust_id,
            "items": [{"product_id": prod_id, "quantity": 100, "unit_price": 100.0, "pricing_mode": "unit_price"}],
            "paid_amount": 10000.0,
            "sale_date": day1_dt.isoformat(),
        },
    )
    assert res_sale.status_code == 201

    res_exp = await async_client.post(
        "/api/v1/expenses",
        headers=auth_headers,
        json={
            "category_id": cat_id,
            "amount": 1000.0,
            "payment_method": "Cash",
            "expense_date": day1_dt.isoformat(),
            "description": "Office Stationery",
        },
    )
    assert res_exp.status_code == 201

    # Check baseline Cash Book before Cash Out:
    # Received = 10,000, Expense = 1,000, Closing = 9,000
    res_cb_before = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_before.status_code == 200
    cb_before = res_cb_before.json()["data"]
    assert cb_before["today_cash_received"] == 10000.0
    assert cb_before["today_cash_expense"] == 1000.0
    assert cb_before["closing_cash_balance"] == 9000.0

    # Check baseline Dashboard Profit before Cash Out:
    async with AsyncSessionLocal() as db:
        dash_before = await dashboard_service.get_dashboard_summary(db, start_date=day1_dt, end_date=day1_dt)
        profit_before = dash_before.total_profit

    # 1 & 2. Open Accounts -> Cash Out and create Cash Out of 2,000
    res_co = await async_client.post(
        "/api/v1/accounts/cash-out",
        headers=auth_headers,
        json={
            "amount": 2000.0,
            "reason": "Owner Withdrawal",
            "cash_out_date": day1_dt.isoformat(),
            "notes": "Personal withdrawal by proprietor",
        },
    )
    # 3. Verify it is saved
    assert res_co.status_code == 201
    co_obj = res_co.json()["data"]
    assert co_obj["amount"] == 2000.0
    assert co_obj["reason"] == "Owner Withdrawal"
    assert co_obj["cash_out_no"].startswith("CO-")

    # 4 & 5. Verify it appears in Cash Book and balance decreases by 2,000
    res_cb_after = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_after.status_code == 200
    cb_after = res_cb_after.json()["data"]
    # Inflow remains 10,000
    assert cb_after["today_cash_received"] == 10000.0
    # Expense remains 1,000 (did NOT increase)
    assert cb_after["today_cash_expense"] == 1000.0
    assert cb_after["total_expense"] == 1000.0
    # Cash Out = 2,000
    assert cb_after["today_cash_out"] == 2000.0
    assert cb_after["total_cash_out"] == 2000.0
    # Total Cash Paid = 1,000 + 2,000 = 3,000
    assert cb_after["total_cash_paid"] == 3000.0
    # Closing balance decreased by 2,000: from 9,000 to 7,000
    assert cb_after["closing_cash_balance"] == 7000.0
    assert cb_after["cash_in_hand"] == 7000.0

    # Verify Cash Out item exists in items
    co_items = [it for it in cb_after["items"] if it["transaction_type"] == "cash_out"]
    assert len(co_items) == 1
    assert co_items[0]["debit"] == 2000.0
    assert co_items[0]["credit"] == 0.0
    assert co_items[0]["name"] == "Owner Withdrawal"

    # 6 & 7. Verify it does NOT appear in Expenses and Total Expense does NOT increase
    res_expenses = await async_client.get(
        f"/api/v1/expenses?start_date={day1_str}&end_date={day1_str}",
        headers=auth_headers,
    )
    assert res_expenses.status_code == 200
    exp_items = res_expenses.json()["data"]["items"]
    assert len(exp_items) == 1  # Only the Office Stationery expense
    assert exp_items[0]["description"] == "Office Stationery"
    assert exp_items[0]["amount"] == 1000.0

    # 8. Verify Profit does NOT decrease because of Cash Out
    async with AsyncSessionLocal() as db:
        dash_after = await dashboard_service.get_dashboard_summary(db, start_date=day1_dt, end_date=day1_dt)
        profit_after = dash_after.total_profit
        # Profit must be identical to profit before Cash Out!
        assert profit_after == profit_before

    # 9. Verify it does not affect Customer Due
    async with AsyncSessionLocal() as db:
        cust_check = await db.get(Customer, cust_id)
        assert cust_check.current_balance == 5000.0

    # 10. Verify it does not affect Supplier Due
    async with AsyncSessionLocal() as db:
        supp_check = await db.get(Supplier, supp_id)
        assert supp_check.current_balance == 3000.0

    # 11. Verify next day's Cash Book still starts from 0
    res_cb_day2 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day2_str}", headers=auth_headers)
    assert res_cb_day2.status_code == 200
    cb_day2 = res_cb_day2.json()["data"]
    assert cb_day2["previous_balance"] == 0.0
    assert cb_day2["today_cash_received"] == 0.0
    assert cb_day2["today_cash_expense"] == 0.0
    assert cb_day2["today_cash_out"] == 0.0
    assert cb_day2["total_cash_paid"] == 0.0
    assert cb_day2["closing_cash_balance"] == 0.0

    # 12. Verify Cash Book summary includes the Cash Out transaction
    assert cb_after["total_cash_out"] == 2000.0
    assert any(it["transaction_type"] == "cash_out" for it in cb_after["items"])
