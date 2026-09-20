import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.customer import Customer
from app.models.expense import Expense, ExpenseCategory
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.sale import Sale
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.models.customer_collection import CustomerCollection
from app.services.cash_book_service import cash_book_service
from app.services.setting_service import setting_service


@pytest.mark.asyncio
async def test_cash_book_calculation_and_three_test_cases(async_client: AsyncClient, auth_headers: dict):
    """
    Verifies all 3 mandatory user test cases and Cash Book precision:
    1. Previous Balance + Cash Inflows - Cash Outflows = Closing Cash
    2. Credit Sale = 0 cash, Collection = 2,000 cash
    3. Partial Cash Sale = 4,000 cash (not 10,000 total)
    """
    unique = uuid.uuid4().hex[:8]

    async with AsyncSessionLocal() as db:
        # Create unique customer & product
        customer = Customer(
            customer_code=f"CB-CUST-{unique}",
            name=f"Cash Book Customer {unique}",
            opening_balance=0.0,
            current_balance=0.0,
            status="active",
        )
        product = Product(
            product_code=f"CB-PROD-{unique}",
            name=f"Cash Book Product {unique}",
            unit="pcs",
            selling_price=100.0,
            current_stock=5000.0,
            opening_stock=5000.0,
            opening_stock_unit_cost=50.0,
            status="active",
        )
        category = ExpenseCategory(
            name=f"CB Category {unique}",
            status="active",
        )
        db.add(customer)
        db.add(product)
        db.add(category)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(product)
        await db.refresh(category)
        cust_id = customer.id
        prod_id = product.id
        cat_id = category.id

    # 1. Fetch current baseline Cash Book
    res_base = await async_client.get("/api/v1/accounts/cash-book", headers=auth_headers)
    assert res_base.status_code == 200, f"Cash book fetch failed: {res_base.text}"
    base_data = res_base.json()["data"]
    base_received = base_data["today_cash_received"]
    base_expense = base_data["today_cash_expense"]
    base_balance = base_data["cash_in_hand"]
    prev_balance = base_data["previous_balance"]

    # --- TEST CASE 3: Partial Cash Sale ---
    # Sale Total = 10,000, Paid = 4,000, Due = 6,000
    res_partial_sale = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": cust_id,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 100,
                    "unit_price": 100.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 4000.0,
        },
    )
    assert res_partial_sale.status_code == 201, f"Partial sale failed: {res_partial_sale.text}"
    partial_sale_data = res_partial_sale.json()["data"]
    assert partial_sale_data["grand_total"] == 10000.0
    assert partial_sale_data["paid_amount"] == 4000.0
    assert partial_sale_data["due_amount"] == 6000.0

    # Verify Cash Book received ONLY 4,000 (not 10,000!)
    res_cb1 = await async_client.get("/api/v1/accounts/cash-book", headers=auth_headers)
    assert res_cb1.status_code == 200
    cb1_data = res_cb1.json()["data"]
    delta_received = round(cb1_data["today_cash_received"] - base_received, 2)
    assert delta_received == 4000.0, f"Expected delta received 4000, got {delta_received}"

    # --- TEST CASE 2: Credit Sale = 0 cash, then Collection = 2,000 ---
    # Credit Sale Total = 5,000, Paid = 0
    res_credit_sale = await async_client.post(
        "/api/v1/sales",
        headers=auth_headers,
        json={
            "customer_id": cust_id,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 50,
                    "unit_price": 100.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 0.0,
        },
    )
    assert res_credit_sale.status_code == 201
    credit_sale_data = res_credit_sale.json()["data"]
    assert credit_sale_data["grand_total"] == 5000.0
    assert credit_sale_data["paid_amount"] == 0.0

    # Verify Cash Book received NO additional cash from the credit sale!
    res_cb2 = await async_client.get("/api/v1/accounts/cash-book", headers=auth_headers)
    assert res_cb2.status_code == 200
    cb2_data = res_cb2.json()["data"]
    assert round(cb2_data["today_cash_received"] - base_received, 2) == 4000.0

    # Now Customer Collection = 2,000
    res_col = await async_client.post(
        "/api/v1/collections",
        headers=auth_headers,
        json={
            "customer_id": cust_id,
            "amount": 2000.0,
            "payment_method": "cash",
            "notes": "Testing Cash Book collection",
        },
    )
    assert res_col.status_code == 201, f"Collection failed: {res_col.text}"

    # Verify Cash Book receives 2,000 cash from collection
    res_cb3 = await async_client.get("/api/v1/accounts/cash-book", headers=auth_headers)
    assert res_cb3.status_code == 200
    cb3_data = res_cb3.json()["data"]
    assert round(cb3_data["today_cash_received"] - base_received, 2) == 6000.0  # 4000 + 2000

    # --- Cash Expense = 500 ---
    res_exp = await async_client.post(
        "/api/v1/expenses",
        headers=auth_headers,
        json={
            "category_id": cat_id,
            "amount": 500.0,
            "payment_method": "Cash",
            "expense_date": datetime.now(timezone.utc).isoformat(),
            "description": "Office Supplies for Cash Book Test",
        },
    )
    assert res_exp.status_code == 201, f"Expense failed: {res_exp.text}"

    # Verify Cash Book expense increased by 500 and Closing Cash is exact
    res_cb4 = await async_client.get("/api/v1/accounts/cash-book", headers=auth_headers)
    assert res_cb4.status_code == 200
    cb4_data = res_cb4.json()["data"]

    delta_exp = round(cb4_data["today_cash_expense"] - base_expense, 2)
    assert delta_exp == 500.0

    # --- TEST CASE 1 FORMULA VERIFICATION: ---
    # Closing Cash = Previous Balance + Cash Received - Cash Expense
    assert round(cb4_data["closing_cash_balance"], 2) == round(
        cb4_data["previous_balance"] + cb4_data["today_cash_received"] - cb4_data["today_cash_expense"], 2
    )
    assert cb4_data["cash_in_hand"] == cb4_data["closing_cash_balance"]

    # Verify items list contains the transactions chronologically
    items = cb4_data["items"]
    assert len(items) >= 4  # Opening row + partial sale + collection + expense
    assert items[0]["description"] == "Previous Balance"
    assert items[0]["debit"] == 0.0
    assert items[0]["credit"] == 0.0
    assert items[0]["balance"] == cb4_data["previous_balance"]

    # Verify running balance integrity on each item
    for i in range(1, len(items)):
        prev_bal = items[i - 1]["balance"]
        curr_bal = items[i]["balance"]
        expected_bal = round(prev_bal + items[i]["credit"] - items[i]["debit"], 2)
        assert curr_bal == expected_bal, f"Running balance mismatch at row {i}: {curr_bal} != {expected_bal}"


@pytest.mark.asyncio
async def test_cash_book_date_filtering_and_previous_balance_continuity(
    async_client: AsyncClient, auth_headers: dict
):
    """
    Verifies Section 11 requirement:
    If yesterday's closing cash was ৳X, then today's opening/previous balance must be ৳X.
    """
    # Query today
    res_today = await async_client.get(
        "/api/v1/accounts/cash-book?target_date=2026-09-20",
        headers=auth_headers,
    )
    assert res_today.status_code == 200
    today_data = res_today.json()["data"]

    # Query yesterday
    res_yest = await async_client.get(
        "/api/v1/accounts/cash-book?target_date=2026-09-19",
        headers=auth_headers,
    )
    assert res_yest.status_code == 200
    yest_data = res_yest.json()["data"]

    # Yesterday's closing cash balance MUST EXACTLY equal Today's previous balance!
    assert round(yest_data["closing_cash_balance"], 2) == round(today_data["previous_balance"], 2)

