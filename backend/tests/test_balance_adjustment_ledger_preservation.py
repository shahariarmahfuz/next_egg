import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.base import Base
from app.models.user import User
from app.models.supplier import Supplier
from app.models.customer import Customer
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier_payment import SupplierPayment
from app.models.sale import Sale, SaleItem
from app.models.customer_collection import CustomerCollection
from app.models.balance_adjustment import BalanceAdjustment
from app.schemas.balance_adjustment import BalanceAdjustmentCreate
from app.schemas.supplier import SupplierCreate
from app.schemas.customer import CustomerCreate
from app.services.balance_adjustment_service import balance_adjustment_service
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
        username="admin_tester",
        email="tester@example.com",
        password_hash="test_hash",
        full_name="Test Administrator",
        role_id=role.id,
        status="active",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user



@pytest.mark.asyncio
async def test_mandatory_supplier_adjustment_history_deletion_preserves_ledger(test_db: AsyncSession, test_user: User):
    """
    MANDATORY TEST SCENARIO:
    1. Initial supplier balance = 1000
    2. Create adjustment = -100
       Expected current balance = 900
       Verify ledger contains: Adjustment -100, Running Due = 900
    3. Delete Adjustment History
       Verify:
         - Adjustment History no longer contains the history record
         - Supplier Ledger STILL contains the adjustment transaction
         - Final Running Due = 900
         - Current Balance = 900
         - No duplicate adjustment
    4. Then test:
       Purchase +500
       Payment -200
       After deletion:
         - Running Due = 1200
         - Current Balance = 1200
         - The deleted history record must have ZERO effect on accounting calculations.
    """
    # 1. Initial supplier balance = 1000
    supplier_in = SupplierCreate(
        name="Test Supplier 1000",
        opening_balance=1000.0,
    )
    supplier = await supplier_service.create_supplier(test_db, supplier_in)
    assert supplier.current_balance == 1000.0
    assert supplier.opening_balance == 1000.0

    # Verify initial ledger
    ledger_initial = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert ledger_initial["summary"]["current_due"] == 1000.0
    assert len(ledger_initial["transactions"]) == 1
    assert ledger_initial["transactions"][0]["type"] == "Opening Balance"
    assert ledger_initial["transactions"][0]["running_balance"] == 1000.0

    # 2. Create adjustment = -100 -> new balance = 900
    adj_in = BalanceAdjustmentCreate(
        new_balance=900.0,
        balance_type="supplier_payable",
        reason="Physical account reconciliation",
        notes="Reconciling supplier ledger difference",
        effective_date=datetime.now(timezone.utc),
    )
    adjustment = await balance_adjustment_service.adjust_supplier_balance(
        test_db, test_user, supplier.id, adj_in
    )
    assert adjustment.difference == -100.0
    assert adjustment.previous_balance == 1000.0
    assert adjustment.new_balance == 900.0
    assert adjustment.is_history_deleted is False

    await test_db.refresh(supplier)
    assert supplier.current_balance == 900.0

    # Verify Adjustment History contains the record
    history_before_delete = await balance_adjustment_service.get_adjustments_for_entity(
        test_db, "supplier", supplier.id
    )
    assert len(history_before_delete) == 1
    assert history_before_delete[0].id == adjustment.id

    # Verify Supplier Ledger contains: Adjustment -100, Running Due = 900
    ledger_after_adj = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert ledger_after_adj["summary"]["current_due"] == 900.0
    assert len(ledger_after_adj["transactions"]) == 2
    adj_tx = ledger_after_adj["transactions"][1]
    assert adj_tx["type"] == "Balance Adjustment"
    assert adj_tx["debit"] == 0.0
    assert adj_tx["credit"] == 100.0
    assert adj_tx["running_balance"] == 900.0

    # 3. Delete Adjustment History
    delete_result = await balance_adjustment_service.delete_supplier_adjustment_history(
        test_db, test_user, adjustment.id, supplier_id=supplier.id
    )
    assert delete_result["deleted"] is True

    # VERIFY: Adjustment History no longer contains the history record
    history_after_delete = await balance_adjustment_service.get_adjustments_for_entity(
        test_db, "supplier", supplier.id
    )
    assert len(history_after_delete) == 0, "Adjustment History UI must not show deleted record"

    # VERIFY: Supplier Ledger STILL contains the adjustment transaction
    ledger_after_delete = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert len(ledger_after_delete["transactions"]) == 2, "Supplier Ledger must still retain the adjustment transaction"
    adj_tx_retained = ledger_after_delete["transactions"][1]
    assert adj_tx_retained["type"] == "Balance Adjustment"
    assert adj_tx_retained["credit"] == 100.0
    assert adj_tx_retained["running_balance"] == 900.0

    # VERIFY: Final Running Due = 900, Current Balance = 900, No duplicate adjustment
    await test_db.refresh(supplier)
    assert supplier.current_balance == 900.0
    assert ledger_after_delete["summary"]["current_due"] == 900.0
    assert ledger_after_delete["transactions"][-1]["running_balance"] == 900.0
    assert ledger_after_delete["summary"]["current_due"] == ledger_after_delete["transactions"][-1]["running_balance"]

    # 4. Then test: Purchase +500, Payment -200
    # Add Purchase of 500
    purchase = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-TEST-001",
        supplier_id=supplier.id,
        user_id=test_user.id,
        purchase_date=datetime.now(timezone.utc),
        subtotal=500.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=500.0,
        paid_amount=0.0,
        due_amount=500.0,
        payment_status="unpaid",
    )
    test_db.add(purchase)
    supplier.current_balance += 500.0
    test_db.add(supplier)
    await test_db.flush()

    # Add Payment of 200
    payment = SupplierPayment(
        id=str(uuid.uuid4()),
        payment_no="SP-TEST-001",
        supplier_id=supplier.id,
        user_id=test_user.id,
        amount=200.0,
        payment_method="cash",
        payment_date=datetime.now(timezone.utc),
    )
    test_db.add(payment)
    supplier.current_balance -= 200.0
    test_db.add(supplier)
    await test_db.commit()

    # After deletion + new transactions:
    # Running Due = 1200, Current Balance = 1200
    await test_db.refresh(supplier)
    assert supplier.current_balance == 1200.0

    ledger_final = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert len(ledger_final["transactions"]) == 4  # Opening (1000) -> Adj (-100 = 900) -> Pur (+500 = 1400) -> Pay (-200 = 1200)
    assert ledger_final["transactions"][0]["running_balance"] == 1000.0
    assert ledger_final["transactions"][1]["running_balance"] == 900.0
    assert ledger_final["transactions"][2]["running_balance"] == 1400.0
    assert ledger_final["transactions"][3]["running_balance"] == 1200.0

    assert ledger_final["summary"]["current_due"] == 1200.0
    assert ledger_final["transactions"][-1]["running_balance"] == 1200.0
    assert ledger_final["summary"]["current_due"] == ledger_final["transactions"][-1]["running_balance"]

    # History UI still remains empty
    history_final = await balance_adjustment_service.get_adjustments_for_entity(
        test_db, "supplier", supplier.id
    )
    assert len(history_final) == 0


@pytest.mark.asyncio
async def test_customer_adjustment_history_deletion_preserves_ledger(test_db: AsyncSession, test_user: User):
    """
    Equivalence Test for Customer Balance Adjustment:
    Verifies that deleting Customer Adjustment History also preserves Customer Ledger accounting transaction.
    """
    # 1. Initial customer balance = 1000
    cust_in = CustomerCreate(
        name="Test Customer 1000",
        opening_balance=1000.0,
    )
    customer = await customer_service.create_customer(test_db, cust_in)
    assert customer.current_balance == 1000.0

    # 2. Create adjustment = -100 -> new balance = 900
    adj_in = BalanceAdjustmentCreate(
        new_balance=900.0,
        balance_type="customer_due",
        reason="Physical account reconciliation",
        notes="Reconciling customer ledger difference",
        effective_date=datetime.now(timezone.utc),
    )
    adjustment = await balance_adjustment_service.adjust_customer_balance(
        test_db, test_user, customer.id, adj_in
    )
    assert adjustment.difference == -100.0

    await test_db.refresh(customer)
    assert customer.current_balance == 900.0

    # 3. Delete Adjustment History
    delete_result = await balance_adjustment_service.delete_customer_adjustment_history(
        test_db, test_user, adjustment.id, customer_id=customer.id
    )
    assert delete_result["deleted"] is True

    # Adjustment history UI must be empty
    history = await balance_adjustment_service.get_adjustments_for_entity(
        test_db, "customer", customer.id
    )
    assert len(history) == 0

    # Customer Ledger must still retain the adjustment transaction
    ledger = await customer_service.get_customer_ledger(test_db, customer.id)
    assert len(ledger["transactions"]) == 2
    assert ledger["transactions"][1]["type"] == "Balance Adjustment"
    assert ledger["transactions"][1]["running_balance"] == 900.0
    assert ledger["summary"]["current_due"] == 900.0
    assert ledger["summary"]["current_due"] == ledger["transactions"][-1]["running_balance"]

    # 4. Sale +500, Collection -200 -> Running Due = 1200, Current Balance = 1200
    sale = Sale(
        id=str(uuid.uuid4()),
        invoice_no="INV-TEST-001",
        customer_id=customer.id,
        user_id=test_user.id,
        sale_date=datetime.now(timezone.utc),
        subtotal=500.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=500.0,
        paid_amount=0.0,
        due_amount=500.0,
        payment_status="unpaid",
    )
    test_db.add(sale)
    customer.current_balance += 500.0
    test_db.add(customer)
    await test_db.flush()

    col = CustomerCollection(
        id=str(uuid.uuid4()),
        collection_no="COL-TEST-001",
        customer_id=customer.id,
        user_id=test_user.id,
        amount=200.0,
        payment_method="cash",
        collection_date=datetime.now(timezone.utc),
    )
    test_db.add(col)
    customer.current_balance -= 200.0
    test_db.add(customer)
    await test_db.commit()

    await test_db.refresh(customer)
    assert customer.current_balance == 1200.0

    ledger_final = await customer_service.get_customer_ledger(test_db, customer.id)
    assert len(ledger_final["transactions"]) == 4
    assert ledger_final["transactions"][-1]["running_balance"] == 1200.0
    assert ledger_final["summary"]["current_due"] == 1200.0


@pytest.mark.asyncio
async def test_recovery_of_historical_deleted_adjustments_from_activity_logs(test_db: AsyncSession, test_user: User):
    """
    Verifies that historical deleted adjustments (such as those in production activity_logs)
    can be recovered into balance_adjustments with is_history_deleted=True without double counting.
    """
    import json
    from app.models.activity_log import ActivityLog

    # Create supplier with initial balance 1000
    supplier_in = SupplierCreate(name="Historical Supplier", opening_balance=1000.0)
    supplier = await supplier_service.create_supplier(test_db, supplier_in)
    
    # Simulate historical state:
    # 1. An adjustment was made in the past (diff: -100, new_balance: 900)
    supplier.current_balance = 900.0
    test_db.add(supplier)
    
    # 2. But the BalanceAdjustment row was deleted in the old system, leaving ONLY an ActivityLog
    historical_adj_id = str(uuid.uuid4())
    log_payload = json.dumps({
        "adjustment_id": historical_adj_id,
        "supplier_id": supplier.id,
        "previous_balance": 1000.0,
        "new_balance": 900.0,
        "difference": -100.0,
        "reason": "Physical account reconciliation",
        "action": "history_record_deleted"
    })
    log_entry = ActivityLog(
        user_id=test_user.id,
        action="supplier.balance.adjustment.delete",
        entity_type="supplier",
        entity_id=supplier.id,
        payload=log_payload,
    )
    test_db.add(log_entry)
    await test_db.commit()

    # Before recovery: Current baseline reflects current_balance (900.0)
    ledger_before = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert ledger_before["transactions"][-1]["running_balance"] == 900.0
    assert supplier.current_balance == 900.0

    # EXECUTE RECOVERY LOGIC (simulating recovery utility):
    recovered = BalanceAdjustment(
        id=historical_adj_id,
        entity_type="supplier",
        entity_id=supplier.id,
        previous_balance=1000.0,
        new_balance=900.0,
        difference=-100.0,
        balance_type="supplier_payable",
        effective_date=datetime.now(timezone.utc),
        reason="Physical account reconciliation",
        notes="Recovered from activity log (history deleted)",
        created_by_user_id=test_user.id,
        created_by_user_name="System Audit Recovery",
        is_history_deleted=True,
    )
    test_db.add(recovered)
    # CRITICAL: supplier.current_balance is NOT modified (no double-counting)
    await test_db.commit()

    # After recovery:
    # 1. Supplier current balance is STILL 900 (not double counted)
    await test_db.refresh(supplier)
    assert supplier.current_balance == 900.0

    # 2. History UI query returns 0 (history remains deleted for user)
    history = await balance_adjustment_service.get_adjustments_for_entity(test_db, "supplier", supplier.id)
    assert len(history) == 0

    # 3. Supplier Ledger now contains the adjustment and running due matches current balance perfectly!
    ledger_after = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert len(ledger_after["transactions"]) == 2
    assert ledger_after["transactions"][1]["type"] == "Balance Adjustment"
    assert ledger_after["transactions"][1]["credit"] == 100.0
    assert ledger_after["transactions"][-1]["running_balance"] == 900.0
    assert ledger_after["summary"]["current_due"] == 900.0
    assert ledger_after["transactions"][-1]["running_balance"] == ledger_after["summary"]["current_due"]


@pytest.mark.asyncio
async def test_supplier_ledger_current_baseline_with_old_and_new_transactions(test_db: AsyncSession, test_user: User):
    """
    Verifies that:
    1. Historical transactions from past dates (before today) are excluded from the visible ledger.
    2. The visible ledger begins from the current baseline (Opening Balance / Current Balance).
    3. Today's transactions appear normally in the ledger.
    4. New balance adjustment created today appears in the ledger.
    5. Running due sequentially updates: Opening Balance -> Purchase -> Payment -> Adjustment.
    6. Final Running Due equals supplier.current_balance to the exact penny.
    """
    from datetime import timedelta
    now_utc = datetime.now(timezone.utc)
    old_date = now_utc - timedelta(days=14)  # 14 days ago

    # Supplier setup: current_balance = 129697.0
    supplier_in = SupplierCreate(name="Baseline Supplier", opening_balance=50000.0)
    supplier = await supplier_service.create_supplier(test_db, supplier_in)
    supplier.current_balance = 129697.0
    test_db.add(supplier)

    # 1. Add historical transactions from 14 days ago (should be HIDDEN from current baseline ledger)
    old_purchase = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-OLD-001",
        supplier_id=supplier.id,
        user_id=test_user.id,
        purchase_date=old_date,
        subtotal=80000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=80000.0,
        paid_amount=0.0,
        due_amount=80000.0,
        payment_status="unpaid",
    )
    test_db.add(old_purchase)

    old_adj = BalanceAdjustment(
        id=str(uuid.uuid4()),
        entity_type="supplier",
        entity_id=supplier.id,
        previous_balance=130000.0,
        new_balance=129697.0,
        difference=-303.0,
        balance_type="supplier_payable",
        effective_date=old_date,
        reason="Old physical reconciliation",
        notes="Historical adjustment",
        created_by_user_id=test_user.id,
        created_by_user_name="Admin",
        is_history_deleted=True,
    )
    test_db.add(old_adj)
    await test_db.commit()

    # Verify ledger before today's transactions:
    # 1. Historical Purchase (PO-OLD-001) is VISIBLE.
    # 2. Historical Balance Adjustment (old_adj) before baseline is HIDDEN.
    # 3. Invisible reconciliation offset (-303.0) reconciles last historical running balance to current_balance (129,697.0).
    ledger_initial = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    assert len(ledger_initial["transactions"]) == 2, "Historical Purchase must remain visible while old adjustment is hidden"
    assert ledger_initial["transactions"][0]["type"] == "Opening Balance"
    assert ledger_initial["transactions"][0]["running_balance"] == 49697.0  # 50,000 - 303
    assert ledger_initial["transactions"][1]["type"] == "Purchase"
    assert ledger_initial["transactions"][1]["voucher_no"] == "PO-OLD-001"
    assert ledger_initial["transactions"][1]["running_balance"] == 129697.0  # 130,000 - 303 = 129,697
    assert ledger_initial["summary"]["current_due"] == 129697.0
    assert ledger_initial["transactions"][-1]["running_balance"] == 129697.0

    # 2. Add TODAY's transactions (on/after 2026-09-23 baseline):
    # Purchase +10,000
    today_pur = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-TODAY-001",
        supplier_id=supplier.id,
        user_id=test_user.id,
        purchase_date=now_utc,
        subtotal=10000.0,
        discount_amount=0.0,
        tax_amount=0.0,
        grand_total=10000.0,
        paid_amount=0.0,
        due_amount=10000.0,
        payment_status="unpaid",
    )
    test_db.add(today_pur)
    supplier.current_balance += 10000.0
    test_db.add(supplier)

    # Payment -5,000
    today_pay = SupplierPayment(
        id=str(uuid.uuid4()),
        payment_no="SP-TODAY-001",
        supplier_id=supplier.id,
        user_id=test_user.id,
        amount=5000.0,
        payment_method="cash",
        payment_date=now_utc,
    )
    test_db.add(today_pay)
    supplier.current_balance -= 5000.0
    test_db.add(supplier)

    # New Balance Adjustment created today (on/after baseline): -2,000 -> must be VISIBLE
    today_adj = BalanceAdjustment(
        id=str(uuid.uuid4()),
        entity_type="supplier",
        entity_id=supplier.id,
        previous_balance=134697.0,
        new_balance=132697.0,
        difference=-2000.0,
        balance_type="supplier_payable",
        effective_date=now_utc,
        reason="Today audit reconciliation",
        notes="New adjustment today",
        created_by_user_id=test_user.id,
        created_by_user_name="Admin",
        is_history_deleted=False,
    )
    test_db.add(today_adj)
    supplier.current_balance -= 2000.0
    test_db.add(supplier)
    await test_db.commit()

    # Refresh supplier
    await test_db.refresh(supplier)
    assert supplier.current_balance == 132697.0

    # 3. Retrieve Supplier Ledger and verify sequence:
    # Expected transactions:
    # Row 1: Opening Balance = 49,697.0 (50,000 - 303 offset)
    # Row 2: Purchase PO-OLD-001 +80,000 -> Running Due = 129,697.0 (reconciled baseline!)
    # Row 3: Purchase PO-TODAY-001 +10,000 -> Running Due = 139,697.0
    # Row 4: Payment SP-TODAY-001 -5,000 -> Running Due = 134,697.0
    # Row 5: Balance Adjustment -2,000 -> Running Due = 132,697.0
    ledger_today_final = await supplier_service.get_supplier_ledger(test_db, supplier.id)
    txs = ledger_today_final["transactions"]

    assert len(txs) == 5, f"Expected 5 visible rows, got {len(txs)}"
    assert txs[0]["type"] == "Opening Balance"
    assert txs[0]["running_balance"] == 49697.0

    assert txs[1]["type"] == "Purchase"
    assert txs[1]["voucher_no"] == "PO-OLD-001"
    assert txs[1]["debit"] == 80000.0
    assert txs[1]["running_balance"] == 129697.0

    assert txs[2]["type"] == "Purchase"
    assert txs[2]["voucher_no"] == "PO-TODAY-001"
    assert txs[2]["debit"] == 10000.0
    assert txs[2]["running_balance"] == 139697.0

    assert txs[3]["type"] == "Supplier Payment"
    assert txs[3]["credit"] == 5000.0
    assert txs[3]["running_balance"] == 134697.0

    assert txs[4]["type"] == "Balance Adjustment"
    assert txs[4]["credit"] == 2000.0
    assert txs[4]["running_balance"] == 132697.0

    # Summary checks:
    summary = ledger_today_final["summary"]
    assert summary["opening_balance"] == 49697.0
    assert summary["total_purchases"] == 90000.0  # 80k + 10k
    assert summary["total_payments"] == 5000.0
    assert summary["total_returns"] == 0.0
    assert summary["manual_adjustments"] == -2000.0  # Only visible adjustments
    assert summary["current_due"] == 132697.0

    # Mathematical identity check: op + pur - pay - ret + adj == current_due
    assert summary["opening_balance"] + summary["total_purchases"] - summary["total_payments"] - summary["total_returns"] + summary["manual_adjustments"] == summary["current_due"]

    # Final Running Due == current_balance
    assert txs[-1]["running_balance"] == supplier.current_balance


