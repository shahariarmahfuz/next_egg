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
from app.models.purchase import Purchase
from app.models.sale import Sale
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.models.customer_collection import CustomerCollection


@pytest.mark.asyncio
async def test_cash_book_eight_mandatory_tests(async_client: AsyncClient, auth_headers: dict):
    """
    Verifies all 8 user requirements:
    TEST 1: Create a Cash Purchase -> does NOT appear in Cash Book.
    TEST 2: Create a Cash Sale of 10,000 -> starts at 0 and ends at 10,000.
    TEST 3: Add Customer Collection of 2,000 -> closing balance = 12,000.
    TEST 4: Add Expense of 1,000 -> closing balance = 11,000.
    TEST 5: Open next day's Cash Book -> Opening Balance = 0 (not 11,000).
    TEST 6: Select previous date again -> date remains independent.
    TEST 7: Credit sale with no payment -> Cash Book receives 0.
    TEST 8: Credit sale with partial payment -> only actual payment appears as inflow.
    """
    unique = uuid.uuid4().hex[:8]
    
    # Use a future isolated business date with random offset to ensure zero prior clutter
    random_days = random.randint(3000, 20000)
    day1_base = date(2028, 1, 1) + timedelta(days=random_days)
    day2_base = day1_base + timedelta(days=1)
    day3_base = day1_base + timedelta(days=2)

    day1_str = day1_base.strftime("%Y-%m-%d")
    day2_str = day2_base.strftime("%Y-%m-%d")
    day3_str = day3_base.strftime("%Y-%m-%d")
    
    day1_dt = datetime(day1_base.year, day1_base.month, day1_base.day, 12, 0, 0, tzinfo=timezone.utc)
    day2_dt = datetime(day2_base.year, day2_base.month, day2_base.day, 12, 0, 0, tzinfo=timezone.utc)
    day3_dt = datetime(day3_base.year, day3_base.month, day3_base.day, 12, 0, 0, tzinfo=timezone.utc)

    async with AsyncSessionLocal() as db:
        customer = Customer(
            customer_code=f"CB-CUST-{unique}",
            name=f"Cash Book Customer {unique}",
            opening_balance=0.0,
            current_balance=0.0,
            status="active",
        )
        supplier = Supplier(
            supplier_code=f"CB-SUPP-{unique}",
            name=f"Cash Book Supplier {unique}",
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
        db.add(supplier)
        db.add(product)
        db.add(category)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(supplier)
        await db.refresh(product)
        await db.refresh(category)
        cust_id = customer.id
        supp_id = supplier.id
        prod_id = product.id
        cat_id = category.id

    # -------------------------------------------------------------
    # Initial Check: Day 1 starts with 0
    # -------------------------------------------------------------
    res_init = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_init.status_code == 200
    init_data = res_init.json()["data"]
    assert init_data["previous_balance"] == 0.0
    assert init_data["today_cash_received"] == 0.0
    assert init_data["today_cash_expense"] == 0.0
    assert init_data["total_cash_paid"] == 0.0
    assert init_data["closing_cash_balance"] == 0.0

    # -------------------------------------------------------------
    # TEST 1: Create a Cash Purchase.
    # Expected: Cash Purchase does NOT appear anywhere in Cash Book.
    # -------------------------------------------------------------
    res_pur = await async_client.post(
        "/api/v1/purchases",
        headers=auth_headers,
        json={
            "supplier_id": supp_id,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 50,
                    "unit_price": 50.0,
                    "pricing_mode": "unit_price",
                }
            ],
            "paid_amount": 2500.0,
            "purchase_date": day1_dt.isoformat(),
        },
    )
    assert res_pur.status_code == 201, f"Purchase creation failed: {res_pur.text}"

    res_cb_test1 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_test1.status_code == 200
    cb1 = res_cb_test1.json()["data"]

    # Purchases must NOT appear in Cash Book
    assert cb1["previous_balance"] == 0.0
    assert cb1["today_cash_received"] == 0.0
    assert cb1["today_cash_expense"] == 0.0
    assert cb1["total_cash_paid"] == 0.0
    assert cb1["total_purchase_paid"] == 0.0
    assert cb1["closing_cash_balance"] == 0.0
    for item in cb1["items"]:
        assert item["transaction_type"] != "cash_purchase"
        assert not item["id"].startswith("pur-")

    # -------------------------------------------------------------
    # TEST 2: Create a Cash Sale of 10,000.
    # Expected: Cash Book starts at 0 and ends at 10,000.
    # -------------------------------------------------------------
    res_sale = await async_client.post(
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
            "paid_amount": 10000.0,
            "sale_date": day1_dt.isoformat(),
        },
    )
    assert res_sale.status_code == 201, f"Sale creation failed: {res_sale.text}"

    res_cb_test2 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_test2.status_code == 200
    cb2 = res_cb_test2.json()["data"]
    assert cb2["previous_balance"] == 0.0
    assert cb2["today_cash_received"] == 10000.0
    assert cb2["closing_cash_balance"] == 10000.0
    assert cb2["cash_in_hand"] == 10000.0

    # -------------------------------------------------------------
    # TEST 3: Add a Customer Collection of 2,000.
    # Expected: Closing balance = 12,000.
    # -------------------------------------------------------------
    res_col = await async_client.post(
        "/api/v1/collections",
        headers=auth_headers,
        json={
            "customer_id": cust_id,
            "amount": 2000.0,
            "payment_method": "cash",
            "collection_date": day1_dt.isoformat(),
            "notes": "Testing Cash Book Collection",
        },
    )
    assert res_col.status_code == 201, f"Collection failed: {res_col.text}"

    res_cb_test3 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_test3.status_code == 200
    cb3 = res_cb_test3.json()["data"]
    assert cb3["previous_balance"] == 0.0
    assert cb3["today_cash_received"] == 12000.0  # 10000 + 2000
    assert cb3["closing_cash_balance"] == 12000.0

    # -------------------------------------------------------------
    # TEST 4: Add an Expense of 1,000.
    # Expected: Closing balance = 11,000.
    # -------------------------------------------------------------
    res_exp = await async_client.post(
        "/api/v1/expenses",
        headers=auth_headers,
        json={
            "category_id": cat_id,
            "amount": 1000.0,
            "payment_method": "Cash",
            "expense_date": day1_dt.isoformat(),
            "description": "Office Supplies",
        },
    )
    assert res_exp.status_code == 201, f"Expense failed: {res_exp.text}"

    res_cb_test4 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_test4.status_code == 200
    cb4 = res_cb_test4.json()["data"]
    assert cb4["previous_balance"] == 0.0
    assert cb4["today_cash_received"] == 12000.0
    assert cb4["today_cash_expense"] == 1000.0
    assert cb4["total_cash_paid"] == 1000.0
    assert cb4["closing_cash_balance"] == 11000.0
    assert cb4["cash_in_hand"] == 11000.0

    # Verify running balance progression in items
    items = cb4["items"]
    assert items[0]["description"] == "Opening Balance"
    assert items[0]["balance"] == 0.0
    for i in range(1, len(items)):
        prev_b = items[i - 1]["balance"]
        cur_b = items[i]["balance"]
        exp_b = round(prev_b + items[i]["credit"] - items[i]["debit"], 2)
        assert cur_b == exp_b

    # -------------------------------------------------------------
    # TEST 5: Open the next day's Cash Book.
    # Expected: Opening Balance = 0. It must NOT show 11,000.
    # -------------------------------------------------------------
    res_cb_test5 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day2_str}", headers=auth_headers)
    assert res_cb_test5.status_code == 200
    cb5 = res_cb_test5.json()["data"]
    assert cb5["previous_balance"] == 0.0
    assert cb5["today_cash_received"] == 0.0
    assert cb5["today_cash_expense"] == 0.0
    assert cb5["total_cash_paid"] == 0.0
    assert cb5["closing_cash_balance"] == 0.0
    assert cb5["cash_in_hand"] == 0.0

    # -------------------------------------------------------------
    # TEST 6: Select the previous date again.
    # Expected: That date's Cash Book remains independent (closing = 11,000).
    # -------------------------------------------------------------
    res_cb_test6 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day1_str}", headers=auth_headers)
    assert res_cb_test6.status_code == 200
    cb6 = res_cb_test6.json()["data"]
    assert cb6["previous_balance"] == 0.0
    assert cb6["today_cash_received"] == 12000.0
    assert cb6["today_cash_expense"] == 1000.0
    assert cb6["closing_cash_balance"] == 11000.0

    # -------------------------------------------------------------
    # TEST 7: A credit sale with no payment.
    # Expected: Cash Book receives 0.
    # -------------------------------------------------------------
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
            "sale_date": day3_dt.isoformat(),
        },
    )
    assert res_credit_sale.status_code == 201

    res_cb_test7 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day3_str}", headers=auth_headers)
    assert res_cb_test7.status_code == 200
    cb7 = res_cb_test7.json()["data"]
    assert cb7["previous_balance"] == 0.0
    assert cb7["today_cash_received"] == 0.0
    assert cb7["closing_cash_balance"] == 0.0

    # -------------------------------------------------------------
    # TEST 8: A credit sale with partial payment.
    # Expected: Only the actual payment appears as cash inflow.
    # -------------------------------------------------------------
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
            "paid_amount": 3000.0,  # Grand total 10,000, Paid 3,000, Due 7,000
            "sale_date": day3_dt.isoformat(),
        },
    )
    assert res_partial_sale.status_code == 201

    res_cb_test8 = await async_client.get(f"/api/v1/accounts/cash-book?target_date={day3_str}", headers=auth_headers)
    assert res_cb_test8.status_code == 200
    cb8 = res_cb_test8.json()["data"]
    assert cb8["previous_balance"] == 0.0
    assert cb8["today_cash_received"] == 3000.0
    assert cb8["closing_cash_balance"] == 3000.0
