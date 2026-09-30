import pytest
import pytest_asyncio
import uuid
import math
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.base import Base
from app.models.user import User
from app.models.supplier import Supplier
from app.models.customer import Customer
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier_payment import SupplierPayment
from app.models.sale import Sale, SaleItem
from app.models.customer_collection import CustomerCollection
from app.schemas.supplier import SupplierCreate
from app.schemas.customer import CustomerCreate
from app.services.supplier_service import supplier_service
from app.services.customer_service import customer_service


@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(test_db: AsyncSession):
    from app.models.role import Role
    role = Role(
        id=str(uuid.uuid4()),
        name="Administrator",
        code="admin",
        is_system=True,
    )
    test_db.add(role)
    await test_db.flush()

    user = User(
        id=str(uuid.uuid4()),
        username="admin_test",
        email="admin@test.com",
        password_hash="fakehash",
        full_name="Admin Test",
        role_id=role.id,
        status="active",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_supplier_ledger_pagination_page_sizes_and_boundaries(test_db: AsyncSession, test_user: User):
    """
    Test Supplier Ledger server-side pagination with:
    - 10, 25, 50, 100 records per page
    - First page, middle page, last page
    - Running Due continuity across page boundaries
    - Complete dataset summary preservation
    """
    now = datetime(2026, 9, 25, 10, 0, 0, tzinfo=timezone.utc)

    # Create supplier with opening balance 5000
    supp_in = SupplierCreate(
        name="Pagination Supplier Ltd",
        opening_balance=5000.0,
    )
    supplier = await supplier_service.create_supplier(test_db, supp_in)

    # Create 20 purchases (+1000 each) and 9 payments (-500 each)
    # Total events: 1 opening balance + 20 purchases + 9 payments = 30 events
    for i in range(20):
        p_date = now + timedelta(hours=i + 1)
        p = Purchase(
            id=str(uuid.uuid4()),
            purchase_no=f"PO-{i+1:03d}",
            supplier_id=supplier.id,
            user_id=test_user.id,
            purchase_date=p_date,
            subtotal=1000.0,
            grand_total=1000.0,
            paid_amount=0.0,
            due_amount=1000.0,
            payment_status="due",
        )
        test_db.add(p)

    for j in range(9):
        sp_date = now + timedelta(hours=25 + j)
        sp = SupplierPayment(
            id=str(uuid.uuid4()),
            payment_no=f"SP-{j+1:03d}",
            supplier_id=supplier.id,
            user_id=test_user.id,
            payment_date=sp_date,
            amount=500.0,
            payment_method="cash",
        )
        test_db.add(sp)

    # 5000 (opening) + 20*1000 (purchases) - 9*500 (payments) = 5000 + 20000 - 4500 = 20500
    supplier.current_balance = 20500.0
    await test_db.commit()

    # 1. Test unpaginated (full ledger)
    full_ledger = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert full_ledger["total"] == 30
    assert len(full_ledger["transactions"]) == 30
    assert full_ledger["summary"]["opening_balance"] == 5000.0
    assert full_ledger["summary"]["total_purchases"] == 20000.0
    assert full_ledger["summary"]["total_payments"] == 4500.0
    assert full_ledger["summary"]["current_due"] == 20500.0
    # Final transaction running balance matches current balance
    assert full_ledger["transactions"][-1]["running_balance"] == 20500.0

    # 2. Test 10 records per page (First, Middle, Last page)
    # Page 1: 10 records
    p1 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=1, page_size=10)
    assert p1["total"] == 30
    assert p1["pages"] == 3
    assert p1["page"] == 1
    assert p1["page_size"] == 10
    assert len(p1["transactions"]) == 10
    assert p1["summary"]["current_due"] == 20500.0
    last_p1_tx = p1["transactions"][-1]

    # Page 2 (middle): 10 records
    p2 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=2, page_size=10)
    assert p2["total"] == 30
    assert p2["pages"] == 3
    assert p2["page"] == 2
    assert p2["page_size"] == 10
    assert len(p2["transactions"]) == 10
    first_p2_tx = p2["transactions"][0]

    # CRITICAL ACCOUNTING CHECK: Running Due continuity across page boundaries
    # first item of page 2 must continue directly from last item of page 1
    expected_p2_first_balance = round(last_p1_tx["running_balance"] + first_p2_tx["debit"] - first_p2_tx["credit"], 2)
    assert first_p2_tx["running_balance"] == expected_p2_first_balance
    assert first_p2_tx["running_balance"] != first_p2_tx["debit"] - first_p2_tx["credit"]  # Not reset to 0!

    # Page 3 (last page): 10 records
    p3 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=3, page_size=10)
    assert p3["total"] == 30
    assert p3["pages"] == 3
    assert p3["page"] == 3
    assert len(p3["transactions"]) == 10
    assert p3["transactions"][-1]["running_balance"] == 20500.0

    # 3. Test 25 records per page (default)
    p25_1 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=1, page_size=25)
    assert p25_1["total"] == 30
    assert p25_1["pages"] == 2
    assert p25_1["page"] == 1
    assert p25_1["page_size"] == 25
    assert len(p25_1["transactions"]) == 25

    p25_2 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=2, page_size=25)
    assert p25_2["total"] == 30
    assert p25_2["pages"] == 2
    assert p25_2["page"] == 2
    assert len(p25_2["transactions"]) == 5  # remaining 5 items
    assert p25_2["transactions"][-1]["running_balance"] == 20500.0

    # 4. Test 50 records per page
    p50 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=1, page_size=50)
    assert p50["total"] == 30
    assert p50["pages"] == 1
    assert p50["page"] == 1
    assert p50["page_size"] == 50
    assert len(p50["transactions"]) == 30

    # 5. Test 100 records per page
    p100 = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=1, page_size=100)
    assert p100["total"] == 30
    assert p100["pages"] == 1
    assert p100["page"] == 1
    assert p100["page_size"] == 100
    assert len(p100["transactions"]) == 30

    # 6. Page past last page returns empty transactions list but valid metadata
    p_past = await supplier_service.get_supplier_ledger(test_db, supplier.id, page=99, page_size=25)
    assert p_past["total"] == 30
    assert p_past["pages"] == 2
    assert p_past["page"] == 99
    assert len(p_past["transactions"]) == 0
    assert p_past["summary"]["current_due"] == 20500.0


@pytest.mark.asyncio
async def test_customer_ledger_pagination_page_sizes_and_boundaries(test_db: AsyncSession, test_user: User):
    """
    Test Customer Ledger server-side pagination with:
    - 10, 25, 50, 100 records per page
    - First page, middle page, last page
    - Running Due continuity across page boundaries
    - Complete dataset summary preservation
    """
    now = datetime(2026, 9, 25, 10, 0, 0, tzinfo=timezone.utc)

    # Create customer with opening balance 3000
    cust_in = CustomerCreate(
        name="Pagination Customer Ltd",
        opening_balance=3000.0,
    )
    customer = await customer_service.create_customer(test_db, cust_in)

    # Create 20 sales (+2000 each) and 9 collections (-1000 each)
    # Total events: 1 opening balance + 20 sales + 9 collections = 30 events
    for i in range(20):
        s_date = now + timedelta(hours=i + 1)
        sale = Sale(
            id=str(uuid.uuid4()),
            invoice_no=f"INV-{i+1:03d}",
            customer_id=customer.id,
            user_id=test_user.id,
            sale_date=s_date,
            subtotal=2000.0,
            grand_total=2000.0,
            paid_amount=0.0,
            due_amount=2000.0,
            payment_status="due",
        )
        test_db.add(sale)

    for j in range(9):
        col_date = now + timedelta(hours=25 + j)
        col = CustomerCollection(
            id=str(uuid.uuid4()),
            collection_no=f"COL-{j+1:03d}",
            customer_id=customer.id,
            user_id=test_user.id,
            collection_date=col_date,
            amount=1000.0,
            payment_method="cash",
        )
        test_db.add(col)

    # 3000 (opening) + 20*2000 (sales) - 9*1000 (collections) = 3000 + 40000 - 9000 = 34000
    customer.current_balance = 34000.0
    await test_db.commit()

    # 1. Full unpaginated ledger
    full_ledger = await customer_service.get_customer_ledger(test_db, customer.id)
    assert full_ledger["total"] == 30
    assert len(full_ledger["transactions"]) == 30
    assert full_ledger["summary"]["opening_balance"] == 3000.0
    assert full_ledger["summary"]["total_sales"] == 40000.0
    assert full_ledger["summary"]["total_collections"] == 9000.0
    assert full_ledger["summary"]["current_due"] == 34000.0
    assert full_ledger["transactions"][-1]["running_balance"] == 34000.0

    # 2. 10 records per page (First, Middle, Last)
    p1 = await customer_service.get_customer_ledger(test_db, customer.id, page=1, page_size=10)
    assert p1["total"] == 30
    assert p1["pages"] == 3
    assert p1["page"] == 1
    assert p1["page_size"] == 10
    assert len(p1["transactions"]) == 10
    last_p1_tx = p1["transactions"][-1]

    p2 = await customer_service.get_customer_ledger(test_db, customer.id, page=2, page_size=10)
    assert p2["total"] == 30
    assert p2["pages"] == 3
    assert p2["page"] == 2
    assert len(p2["transactions"]) == 10
    first_p2_tx = p2["transactions"][0]

    # Continuity check: page 2 first item running balance continues from page 1 last item
    expected_p2_first_balance = round(last_p1_tx["running_balance"] + first_p2_tx["debit"] - first_p2_tx["credit"], 2)
    assert first_p2_tx["running_balance"] == expected_p2_first_balance

    p3 = await customer_service.get_customer_ledger(test_db, customer.id, page=3, page_size=10)
    assert p3["total"] == 30
    assert p3["pages"] == 3
    assert p3["page"] == 3
    assert len(p3["transactions"]) == 10
    assert p3["transactions"][-1]["running_balance"] == 34000.0

    # 3. 25 records per page
    p25_1 = await customer_service.get_customer_ledger(test_db, customer.id, page=1, page_size=25)
    assert p25_1["total"] == 30
    assert p25_1["pages"] == 2
    assert len(p25_1["transactions"]) == 25

    p25_2 = await customer_service.get_customer_ledger(test_db, customer.id, page=2, page_size=25)
    assert p25_2["total"] == 30
    assert p25_2["pages"] == 2
    assert len(p25_2["transactions"]) == 5

    # 4. 50 records per page
    p50 = await customer_service.get_customer_ledger(test_db, customer.id, page=1, page_size=50)
    assert p50["total"] == 30
    assert p50["pages"] == 1
    assert len(p50["transactions"]) == 30

    # 5. 100 records per page
    p100 = await customer_service.get_customer_ledger(test_db, customer.id, page=1, page_size=100)
    assert p100["total"] == 30
    assert p100["pages"] == 1
    assert len(p100["transactions"]) == 30


@pytest.mark.asyncio
async def test_ledger_pagination_with_date_range_and_all(test_db: AsyncSession, test_user: User):
    """
    Test that date range filtering correctly reduces total count, calculates running due,
    and paginates the filtered subset.
    """
    now = datetime(2026, 9, 20, 10, 0, 0, tzinfo=timezone.utc)

    supp_in = SupplierCreate(
        name="Filtered Supplier Ltd",
        opening_balance=1000.0,
    )
    supplier = await supplier_service.create_supplier(test_db, supp_in)

    # 15 purchases: 5 on Sept 21, 5 on Sept 22, 5 on Sept 23
    for i in range(15):
        day_offset = i // 5 + 1
        p_date = now + timedelta(days=day_offset, hours=i % 5)
        p = Purchase(
            id=str(uuid.uuid4()),
            purchase_no=f"PO-FILT-{i+1:03d}",
            supplier_id=supplier.id,
            user_id=test_user.id,
            purchase_date=p_date,
            subtotal=500.0,
            grand_total=500.0,
            paid_amount=0.0,
            due_amount=500.0,
            payment_status="due",
        )
        test_db.add(p)

    supplier.current_balance = 1000.0 + 15 * 500.0
    await test_db.commit()

    # Filter only Sept 22 (day_offset == 2) -> 5 purchases
    start_filter = datetime(2026, 9, 22, 0, 0, 0, tzinfo=timezone.utc)
    end_filter = datetime(2026, 9, 22, 23, 59, 59, tzinfo=timezone.utc)

    # Paginate filtered with page_size=2
    res_p1 = await supplier_service.get_supplier_ledger(
        test_db, supplier.id, start_date=start_filter, end_date=end_filter, page=1, page_size=2
    )
    assert res_p1["total"] == 5
    assert res_p1["pages"] == 3
    assert len(res_p1["transactions"]) == 2
    # The first filtered item's running balance includes the opening balance + prior purchases!
    # Opening 1000 + 5 purchases on Sept 21 (2500) + 1st purchase on Sept 22 (500) = 4000
    assert res_p1["transactions"][0]["running_balance"] == 4000.0

    res_p2 = await supplier_service.get_supplier_ledger(
        test_db, supplier.id, start_date=start_filter, end_date=end_filter, page=2, page_size=2
    )
    assert len(res_p2["transactions"]) == 2
    # Continuing balance
    assert res_p2["transactions"][0]["running_balance"] == 5000.0

    res_p3 = await supplier_service.get_supplier_ledger(
        test_db, supplier.id, start_date=start_filter, end_date=end_filter, page=3, page_size=2
    )
    assert len(res_p3["transactions"]) == 1
    assert res_p3["transactions"][0]["running_balance"] == 6000.0
