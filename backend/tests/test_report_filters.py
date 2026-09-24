import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models.role import Role
from app.models.user import User
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.purchase import Purchase, PurchaseItem
from app.repositories.sale_repository import sale_repository
from app.repositories.purchase_repository import purchase_repository
from app.services.sale_service import sale_service
from app.services.purchase_service import purchase_service
from app.api.v1.endpoints.purchases import list_purchases


@pytest_asyncio.fixture
async def memory_db():
    """Completely isolated in-memory SQLite database - zero production touch."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with session_maker() as session:
        yield session

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_sales_report_filter_cases(memory_db: AsyncSession):
    """
    Test sales report filter requirements:
    Case 1: Sale total = 1000, Paid = 1000, Due = 0
            -> All: included, Paid: included, Due: NOT included
    Case 2: Sale total = 1000, Paid = 0, Due = 1000
            -> All: included, Paid: NOT included, Due: included
    Case 3: Sale total = 1000, Paid = 400, Due = 600
            -> All: included, Paid: NOT included, Due: included
    """
    db = memory_db
    now = datetime.now(timezone.utc)

    # 1. Setup Role & User & Customer
    role = Role(
        id=str(uuid.uuid4()),
        name="Admin Role",
        code="admin",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    user = User(
        id=str(uuid.uuid4()),
        full_name="Filter Test User",
        username="filter_test_user",
        email="test@user.com",
        password_hash="fakehash",
        role_id=role.id,
        status="active",
    )
    db.add(user)

    customer = Customer(
        id=str(uuid.uuid4()),
        customer_code="CUST-FLT-001",
        name="Filter Test Customer",
        opening_balance=0.0,
        current_balance=0.0,
        advance_balance=0.0,
        credit_limit=100000.0,
        status="active",
    )
    db.add(customer)
    await db.flush()

    # Case 1: Fully Paid Sale
    sale1 = Sale(
        id=str(uuid.uuid4()),
        invoice_no="SL-00001",
        customer_id=customer.id,
        user_id=user.id,
        sale_date=now - timedelta(days=2),
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=1000.0,
        due_amount=0.0,
        payment_status="paid",
    )
    db.add(sale1)

    # Case 2: Completely Unpaid Sale
    sale2 = Sale(
        id=str(uuid.uuid4()),
        invoice_no="SL-00002",
        customer_id=customer.id,
        user_id=user.id,
        sale_date=now - timedelta(days=1),
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=0.0,
        due_amount=1000.0,
        payment_status="unpaid",
    )
    db.add(sale2)

    # Case 3: Partially Paid Sale
    sale3 = Sale(
        id=str(uuid.uuid4()),
        invoice_no="SL-00003",
        customer_id=customer.id,
        user_id=user.id,
        sale_date=now,
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=400.0,
        due_amount=600.0,
        payment_status="partial",
    )
    db.add(sale3)
    await db.commit()

    # TEST: Filter = ALL (None or "")
    sales_all, total_all = await sale_repository.get_filtered(db, payment_status=None)
    invoices_all = {s.invoice_no for s in sales_all}
    assert total_all == 3
    assert invoices_all == {"SL-00001", "SL-00002", "SL-00003"}

    sales_empty, total_empty = await sale_repository.get_filtered(db, payment_status="")
    assert total_empty == 3

    # TEST: Filter = PAID ("paid")
    # -> Case 1: included
    # -> Case 2: NOT included
    # -> Case 3: NOT included
    sales_paid, total_paid = await sale_repository.get_filtered(db, payment_status="paid")
    invoices_paid = {s.invoice_no for s in sales_paid}
    assert total_paid == 1
    assert invoices_paid == {"SL-00001"}
    assert "SL-00002" not in invoices_paid
    assert "SL-00003" not in invoices_paid

    # TEST: Filter = DUE ("due")
    # -> Case 1: NOT included
    # -> Case 2: included
    # -> Case 3: included
    sales_due, total_due = await sale_repository.get_filtered(db, payment_status="due")
    invoices_due = {s.invoice_no for s in sales_due}
    assert total_due == 2
    assert "SL-00001" not in invoices_due
    assert "SL-00002" in invoices_due
    assert "SL-00003" in invoices_due

    # TEST: Filter = DUE case-insensitivity ("Due", "DUE")
    sales_due_cap, total_due_cap = await sale_repository.get_filtered(db, payment_status="Due")
    assert total_due_cap == 2
    assert {s.invoice_no for s in sales_due_cap} == {"SL-00002", "SL-00003"}

    # TEST: Report Summary Aggregate for Filter = DUE
    summary_due = await sale_repository.get_report_summary(db, payment_status="due")
    assert summary_due["total_sales"] == 2
    assert summary_due["total_sale_amount"] == 2000.0
    assert summary_due["total_paid"] == 400.0
    assert summary_due["total_due"] == 1600.0

    # TEST: Report Summary Aggregate for Filter = PAID
    summary_paid = await sale_repository.get_report_summary(db, payment_status="paid")
    assert summary_paid["total_sales"] == 1
    assert summary_paid["total_sale_amount"] == 1000.0
    assert summary_paid["total_paid"] == 1000.0
    assert summary_paid["total_due"] == 0.0

    # TEST: Report Summary Aggregate for Filter = ALL
    summary_all = await sale_repository.get_report_summary(db, payment_status=None)
    assert summary_all["total_sales"] == 3
    assert summary_all["total_sale_amount"] == 3000.0
    assert summary_all["total_paid"] == 1400.0
    assert summary_all["total_due"] == 1600.0

    # TEST: Date filter combined with DUE
    # Sale 2 is now - 1 day, Sale 3 is now
    sales_due_date, total_due_date = await sale_repository.get_filtered(
        db,
        payment_status="due",
        start_date=now - timedelta(hours=12),
        end_date=now + timedelta(hours=12),
    )
    assert total_due_date == 1
    assert sales_due_date[0].invoice_no == "SL-00003"

    # TEST: Pagination combined with DUE
    sales_due_p1, _ = await sale_repository.get_filtered(db, payment_status="due", skip=0, limit=1)
    sales_due_p2, _ = await sale_repository.get_filtered(db, payment_status="due", skip=1, limit=1)
    assert len(sales_due_p1) == 1
    assert len(sales_due_p2) == 1
    assert sales_due_p1[0].id != sales_due_p2[0].id

    # TEST: Via sale_service.get_sales_paginated
    svc_sales_due, svc_total_due = await sale_service.get_sales_paginated(db, payment_status="due")
    assert svc_total_due == 2
    assert {s.invoice_no for s in svc_sales_due} == {"SL-00002", "SL-00003"}

    # TEST: Via sale_service.get_sale_reports
    svc_report_due = await sale_service.get_sale_reports(db, payment_status="due")
    assert svc_report_due["total_sales"] == 2
    assert svc_report_due["total_due"] == 1600.0


@pytest.mark.asyncio
async def test_purchase_report_filter_cases(memory_db: AsyncSession):
    """
    Test purchase report filter requirements:
    Case 1: Purchase total = 1000, Paid = 1000, Due = 0
            -> All: included, Paid: included, Due: NOT included
    Case 2: Purchase total = 1000, Paid = 0, Due = 1000
            -> All: included, Paid: NOT included, Due: included
    Case 3: Purchase total = 1000, Paid = 400, Due = 600
            -> All: included, Paid: NOT included, Due: included
    """
    db = memory_db
    now = datetime.now(timezone.utc)

    # 1. Setup Role & User & Supplier
    role = Role(
        id=str(uuid.uuid4()),
        name="Purchase Admin Role",
        code="purch_admin",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    user = User(
        id=str(uuid.uuid4()),
        full_name="Purch Test User",
        username="purch_test_user",
        email="test_purch@user.com",
        password_hash="fakehash",
        role_id=role.id,
        status="active",
    )
    db.add(user)

    supplier = Supplier(
        id=str(uuid.uuid4()),
        supplier_code="SUPP-FLT-001",
        name="Filter Test Supplier",
        opening_balance=0.0,
        current_balance=0.0,
        status="active",
    )
    db.add(supplier)
    await db.flush()

    # Case 1: Fully Paid Purchase
    po1 = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-2026-00001",
        supplier_id=supplier.id,
        user_id=user.id,
        purchase_date=now - timedelta(days=2),
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=1000.0,
        due_amount=0.0,
        payment_status="paid",
    )
    db.add(po1)

    # Case 2: Completely Unpaid Purchase
    po2 = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-2026-00002",
        supplier_id=supplier.id,
        user_id=user.id,
        purchase_date=now - timedelta(days=1),
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=0.0,
        due_amount=1000.0,
        payment_status="unpaid",
    )
    db.add(po2)

    # Case 3: Partially Paid Purchase
    po3 = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-2026-00003",
        supplier_id=supplier.id,
        user_id=user.id,
        purchase_date=now,
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=400.0,
        due_amount=600.0,
        payment_status="partial",
    )
    db.add(po3)
    await db.commit()

    # TEST: Filter = ALL (None or "")
    purchases_all, total_all = await purchase_repository.get_filtered(db, payment_status=None)
    numbers_all = {p.purchase_no for p in purchases_all}
    assert total_all == 3
    assert numbers_all == {"PO-2026-00001", "PO-2026-00002", "PO-2026-00003"}

    purchases_empty, total_empty = await purchase_repository.get_filtered(db, payment_status="")
    assert total_empty == 3

    # TEST: Filter = PAID ("paid")
    # -> Case 1: included
    # -> Case 2: NOT included
    # -> Case 3: NOT included
    purchases_paid, total_paid = await purchase_repository.get_filtered(db, payment_status="paid")
    numbers_paid = {p.purchase_no for p in purchases_paid}
    assert total_paid == 1
    assert numbers_paid == {"PO-2026-00001"}
    assert "PO-2026-00002" not in numbers_paid
    assert "PO-2026-00003" not in numbers_paid

    # TEST: Filter = DUE ("due")
    # -> Case 1: NOT included
    # -> Case 2: included
    # -> Case 3: included
    purchases_due, total_due = await purchase_repository.get_filtered(db, payment_status="due")
    numbers_due = {p.purchase_no for p in purchases_due}
    assert total_due == 2
    assert "PO-2026-00001" not in numbers_due
    assert "PO-2026-00002" in numbers_due
    assert "PO-2026-00003" in numbers_due

    # TEST: Filter = DUE case-insensitivity ("Due", "DUE")
    purchases_due_cap, total_due_cap = await purchase_repository.get_filtered(db, payment_status="Due")
    assert total_due_cap == 2
    assert {p.purchase_no for p in purchases_due_cap} == {"PO-2026-00002", "PO-2026-00003"}

    # TEST: Date filter combined with DUE
    purchases_due_date, total_due_date = await purchase_repository.get_filtered(
        db,
        payment_status="due",
        start_date=now - timedelta(hours=12),
        end_date=now + timedelta(hours=12),
    )
    assert total_due_date == 1
    assert purchases_due_date[0].purchase_no == "PO-2026-00003"

    # TEST: Pagination combined with DUE
    purchases_due_p1, _ = await purchase_repository.get_filtered(db, payment_status="due", skip=0, limit=1)
    purchases_due_p2, _ = await purchase_repository.get_filtered(db, payment_status="due", skip=1, limit=1)
    assert len(purchases_due_p1) == 1
    assert len(purchases_due_p2) == 1
    assert purchases_due_p1[0].id != purchases_due_p2[0].id

    # TEST: Via purchase_service.get_purchases_paginated
    svc_purchases_due, svc_total_due = await purchase_service.get_purchases_paginated(db, payment_status="due")
    assert svc_total_due == 2
    assert {p.purchase_no for p in svc_purchases_due} == {"PO-2026-00002", "PO-2026-00003"}


@pytest.mark.asyncio
async def test_purchase_report_summary_calculations(memory_db: AsyncSession):
    """
    Test purchase report summary totals per requirements:
    Example purchase A:
        Total = 1000
        Paid = 600
        Due = 400
    Example purchase B:
        Total = 2000
        Paid = 2000
        Due = 0

    For All:
        Total Purchases = 3000
        Total Paid = 2600
        Total Due = 400

    For Paid:
        Total Purchases = 2000
        Total Paid = 2000
        Total Due = 0

    For Due:
        Total Purchases = 1000
        Total Paid = 600
        Total Due = 400

    Also tests:
        - date range filtering
        - search filtering
        - Due status filtering
        - pagination does NOT reduce summary totals
        - decimal amounts
    """
    db = memory_db
    now = datetime.now(timezone.utc)

    role = Role(
        id=str(uuid.uuid4()),
        name="Purch Summary Role",
        code="purch_summary_admin",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    user = User(
        id=str(uuid.uuid4()),
        full_name="Purch Summary User",
        username="purch_sum_user",
        email="test_sum@user.com",
        password_hash="fakehash",
        role_id=role.id,
        status="active",
    )
    db.add(user)

    supplier1 = Supplier(
        id=str(uuid.uuid4()),
        supplier_code="SUPP-SUM-001",
        name="Apex Poultry Feed",
        opening_balance=0.0,
        current_balance=0.0,
        status="active",
    )
    supplier2 = Supplier(
        id=str(uuid.uuid4()),
        supplier_code="SUPP-SUM-002",
        name="Beacon Farm Supplies",
        opening_balance=0.0,
        current_balance=0.0,
        status="active",
    )
    db.add_all([supplier1, supplier2])
    await db.flush()

    prod1 = Product(
        id=str(uuid.uuid4()),
        product_code="PROD-SUM-001",
        name="Layer Feed 50kg",
        unit="bag",
        opening_stock_unit_cost=50.0,
        selling_price=60.0,
        current_stock=100.0,
        status="active",
    )
    prod2 = Product(
        id=str(uuid.uuid4()),
        product_code="PROD-SUM-002",
        name="Broiler Feed 50kg",
        unit="bag",
        opening_stock_unit_cost=50.0,
        selling_price=60.0,
        current_stock=100.0,
        status="active",
    )
    db.add_all([prod1, prod2])
    await db.flush()

    # Example purchase A: Total = 1000, Paid = 600, Due = 400 (Items quantity: 15 + 5 = 20)
    po_a = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-EX-A",
        invoice_no="INV-A-101",
        supplier_id=supplier1.id,
        user_id=user.id,
        purchase_date=now - timedelta(days=1),
        subtotal=1000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=1000.0,
        paid_amount=600.0,
        due_amount=400.0,
        payment_status="partial",
    )
    db.add(po_a)
    await db.flush()

    item_a1 = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=po_a.id,
        product_id=prod1.id,
        quantity=15.0,
        unit_price=50.0,
        discount=0.0,
        total_price=750.0,
    )
    item_a2 = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=po_a.id,
        product_id=prod2.id,
        quantity=5.0,
        unit_price=50.0,
        discount=0.0,
        total_price=250.0,
    )
    db.add_all([item_a1, item_a2])

    # Example purchase B: Total = 2000, Paid = 2000, Due = 0 (Items quantity: 40)
    po_b = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-EX-B",
        invoice_no="INV-B-202",
        supplier_id=supplier2.id,
        user_id=user.id,
        purchase_date=now - timedelta(days=3),
        subtotal=2000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=2000.0,
        paid_amount=2000.0,
        due_amount=0.0,
        payment_status="paid",
    )
    db.add(po_b)
    await db.flush()

    item_b1 = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=po_b.id,
        product_id=prod1.id,
        quantity=40.0,
        unit_price=50.0,
        discount=0.0,
        total_price=2000.0,
    )
    db.add(item_b1)
    await db.commit()

    # 1. Summary for All:
    # Total Purchases = 3000, Total Paid = 2600, Total Due = 400, Total Quantity = 60 (20 + 40)
    summary_all = await purchase_service.get_purchase_summary(db, payment_status=None)
    assert summary_all["total_purchases"] == 3000.0
    assert summary_all["total_amount"] == 3000.0
    assert summary_all["total_paid"] == 2600.0
    assert summary_all["paid_amount"] == 2600.0
    assert summary_all["total_due"] == 400.0
    assert summary_all["due_amount"] == 400.0
    assert summary_all["total_quantity"] == 60.0
    assert summary_all["count"] == 2

    # Empty string status should also mean All
    summary_empty = await purchase_service.get_purchase_summary(db, payment_status="")
    assert summary_empty["total_purchases"] == 3000.0
    assert summary_empty["total_paid"] == 2600.0
    assert summary_empty["total_due"] == 400.0
    assert summary_empty["total_quantity"] == 60.0

    # 2. Summary for Paid:
    # Total Purchases = 2000, Total Paid = 2000, Total Due = 0, Total Quantity = 40
    summary_paid = await purchase_service.get_purchase_summary(db, payment_status="paid")
    assert summary_paid["total_purchases"] == 2000.0
    assert summary_paid["total_paid"] == 2000.0
    assert summary_paid["total_due"] == 0.0
    assert summary_paid["total_quantity"] == 40.0
    assert summary_paid["count"] == 1

    # 3. Summary for Due:
    # Total Purchases = 1000, Total Paid = 600, Total Due = 400, Total Quantity = 20
    summary_due = await purchase_service.get_purchase_summary(db, payment_status="due")
    assert summary_due["total_purchases"] == 1000.0
    assert summary_due["total_paid"] == 600.0
    assert summary_due["total_due"] == 400.0
    assert summary_due["total_quantity"] == 20.0
    assert summary_due["count"] == 1

    # Case-insensitive Due status ("Due", "DUE")
    summary_due_cap = await purchase_service.get_purchase_summary(db, payment_status="Due")
    assert summary_due_cap["total_purchases"] == 1000.0
    assert summary_due_cap["total_due"] == 400.0
    assert summary_due_cap["total_quantity"] == 20.0

    # 4. Pagination does NOT reduce summary totals
    # Even if paginated to 1 per page, the summary reflects all 2 purchases
    p_page1, total_count = await purchase_service.get_purchases_paginated(db, skip=0, limit=1)
    assert len(p_page1) == 1
    assert total_count == 2
    sum_paginated = await purchase_service.get_purchase_summary(db)
    assert sum_paginated["total_purchases"] == 3000.0
    assert sum_paginated["total_paid"] == 2600.0
    assert sum_paginated["total_due"] == 400.0
    assert sum_paginated["total_quantity"] == 60.0

    # 5. Date range filtering:
    # Filter to only past 36 hours (only includes Purchase A from 1 day ago)
    summary_date = await purchase_service.get_purchase_summary(
        db,
        start_date=now - timedelta(days=2),
        end_date=now,
    )
    assert summary_date["total_purchases"] == 1000.0
    assert summary_date["total_paid"] == 600.0
    assert summary_date["total_due"] == 400.0
    assert summary_date["total_quantity"] == 20.0
    assert summary_date["count"] == 1

    # 6. Search filtering:
    # Search for "Apex" or "INV-A"
    summary_search = await purchase_service.get_purchase_summary(db, search="Apex")
    assert summary_search["total_purchases"] == 1000.0
    assert summary_search["total_paid"] == 600.0
    assert summary_search["total_due"] == 400.0
    assert summary_search["total_quantity"] == 20.0

    summary_search_b = await purchase_service.get_purchase_summary(db, search="PO-EX-B")
    assert summary_search_b["total_purchases"] == 2000.0
    assert summary_search_b["total_paid"] == 2000.0
    assert summary_search_b["total_due"] == 0.0
    assert summary_search_b["total_quantity"] == 40.0

    # 7. Decimal amounts & quantities:
    po_c = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-EX-DECIMAL",
        invoice_no="INV-DEC-303",
        supplier_id=supplier1.id,
        user_id=user.id,
        purchase_date=now,
        subtotal=123.45,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=123.45,
        paid_amount=23.45,
        due_amount=100.00,
        payment_status="partial",
    )
    db.add(po_c)
    await db.flush()

    item_c = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=po_c.id,
        product_id=prod1.id,
        quantity=2.5,
        unit_price=49.38,
        discount=0.0,
        total_price=123.45,
    )
    db.add(item_c)
    await db.commit()

    summary_dec = await purchase_service.get_purchase_summary(db, search="PO-EX-DECIMAL")
    assert summary_dec["total_purchases"] == 123.45
    assert summary_dec["total_paid"] == 23.45
    assert summary_dec["total_due"] == 100.00
    assert summary_dec["total_quantity"] == 2.5

    # 8. Test list_purchases endpoint response envelope includes aggregate with total_quantity
    endpoint_res = await list_purchases(
        page=1,
        size=15,
        search="PO-EX-DECIMAL",
        db=db,
        current_user=user,
    )
    assert endpoint_res.success is True
    assert endpoint_res.data.aggregate is not None
    assert endpoint_res.data.aggregate["total_purchases"] == 123.45
    assert endpoint_res.data.aggregate["total_paid"] == 23.45
    assert endpoint_res.data.aggregate["total_due"] == 100.00
    assert endpoint_res.data.aggregate["total_quantity"] == 2.5

