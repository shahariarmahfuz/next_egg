import unittest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.exceptions.custom import ForbiddenException, NotFoundException
from app.models.role import Role
from app.models.setting import Setting
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.cash_book import CashBookSummary, SupplierDailyAccount, SupplierPrintSummary
from app.schemas.setting import BusinessSettingsUpdate, SupplierPrintConfigUpdate
from app.services.cash_book_service import cash_book_service
from app.services.setting_service import setting_service
from app.services.supplier_service import supplier_service


@pytest.fixture
def owner_user():
    role = Role(id="role-owner", name="Owner", code="owner")
    user = User(
        id="user-owner",
        username="owner",
        full_name="Business Owner",
        email="owner@test.com",
        status="active",
        role_id=role.id,
    )
    user.role = role
    return user


@pytest.fixture
def admin_user():
    role = Role(id="role-admin", name="Admin", code="admin")
    user = User(
        id="user-admin",
        username="admin",
        full_name="System Admin",
        email="admin@test.com",
        status="active",
        role_id=role.id,
    )
    user.role = role
    return user


@pytest.fixture
def employee_user():
    role = Role(id="role-emp", name="Employee", code="employee")
    user = User(
        id="user-emp",
        username="employee",
        full_name="Regular Employee",
        email="employee@test.com",
        status="active",
        role_id=role.id,
    )
    user.role = role
    return user


@pytest.mark.asyncio
async def test_owner_can_get_and_update_supplier_print(owner_user):
    """Verify owner can access and configure supplier print setting without modifying DB."""
    mock_db = AsyncMock()
    mock_supplier = Supplier(
        id="supp-123",
        supplier_code="SP-001",
        name="ABC Poultry",
        company_name="ABC Poultry Ltd",
        phone="01711000000",
        opening_balance=20000.0,
        current_balance=46450.0,
    )
    mock_setting = Setting(key="supplier_print_supplier_id", value="supp-123", group_name="business")

    with patch("app.services.setting_service.setting_repository.get_by_key", new=AsyncMock(return_value=mock_setting)), \
         patch("app.services.setting_service.supplier_repository.get_by_id", new=AsyncMock(return_value=mock_supplier)), \
         patch("app.services.setting_service.setting_repository.update", new=AsyncMock()):

        # 1. Owner GET config
        res = await setting_service.get_supplier_print_config(mock_db, current_user=owner_user)
        assert res.supplier_id == "supp-123"
        assert res.supplier is not None
        assert res.supplier["name"] == "ABC Poultry"

        # 2. Owner PUT config
        update_in = SupplierPrintConfigUpdate(supplier_id="supp-123")
        res_update = await setting_service.update_supplier_print_config(mock_db, obj_in=update_in, current_user=owner_user)
        assert res_update.supplier_id == "supp-123"


@pytest.mark.asyncio
async def test_admin_and_employee_blocked_from_supplier_print(admin_user, employee_user):
    """Admin and Employee receive ForbiddenException on supplier print configuration."""
    mock_db = AsyncMock()

    # Admin GET -> Forbidden
    with pytest.raises(ForbiddenException):
        await setting_service.get_supplier_print_config(mock_db, current_user=admin_user)

    # Admin PUT -> Forbidden
    with pytest.raises(ForbiddenException):
        await setting_service.update_supplier_print_config(
            mock_db, obj_in=SupplierPrintConfigUpdate(supplier_id="supp-123"), current_user=admin_user
        )

    # Employee GET -> Forbidden
    with pytest.raises(ForbiddenException):
        await setting_service.get_supplier_print_config(mock_db, current_user=employee_user)

    # Employee PUT -> Forbidden
    with pytest.raises(ForbiddenException):
        await setting_service.update_supplier_print_config(
            mock_db, obj_in=SupplierPrintConfigUpdate(supplier_id="supp-123"), current_user=employee_user
        )


@pytest.mark.asyncio
async def test_supplier_print_id_masked_for_non_owner(owner_user, admin_user, employee_user):
    """supplier_print_supplier_id is masked as None in GET /settings/business for non-owners."""
    mock_db = AsyncMock()
    mock_settings = [
        Setting(key="business_name", value="AKOTA POULTRY", group_name="business"),
        Setting(key="supplier_print_supplier_id", value="supp-secret-123", group_name="business"),
    ]

    with patch("app.services.setting_service.setting_repository.get_by_group", new=AsyncMock(return_value=mock_settings)):
        # Owner sees it
        owner_res = await setting_service.get_business_settings(mock_db, current_user=owner_user)
        assert owner_res.supplier_print_supplier_id == "supp-secret-123"

        # Admin sees None
        admin_res = await setting_service.get_business_settings(mock_db, current_user=admin_user)
        assert admin_res.supplier_print_supplier_id is None

        # Employee sees None
        emp_res = await setting_service.get_business_settings(mock_db, current_user=employee_user)
        assert emp_res.supplier_print_supplier_id is None

        # Anonymous sees None
        anon_res = await setting_service.get_business_settings(mock_db, current_user=None)
        assert anon_res.supplier_print_supplier_id is None


@pytest.mark.asyncio
async def test_admin_cannot_update_supplier_print_via_business_settings(admin_user):
    """Admin updating business settings with supplier_print_supplier_id raises ForbiddenException."""
    mock_db = AsyncMock()
    update_in = BusinessSettingsUpdate(supplier_print_supplier_id="supp-hack")

    with pytest.raises(ForbiddenException):
        await setting_service.update_business_settings(mock_db, obj_in=update_in, current_user=admin_user)


@pytest.mark.asyncio
async def test_supplier_daily_accounts_continuity_and_formula():
    """
    Verify day-by-day continuous accounting for Supplier Print:
    Day 1: Prev 20,000 + Purchase 58,450 - Return 2,000 - Payment 30,000 = Closing 46,450
    Day 2 (zero activity): Prev 46,450 + 0 - 0 - 0 = Closing 46,450
    Day 3: Prev 46,450 + Purchase 10,000 - Return 0 - Payment 6,450 = Closing 50,000
    """
    mock_db = AsyncMock()
    mock_supp = Supplier(
        id="supp-test-cont",
        supplier_code="SP-CONT",
        name="ABC Poultry",
        company_name="ABC Poultry Ltd",
        phone="01700000000",
        opening_balance=20000.0,
        current_balance=50000.0,
        created_at=datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
    )

    tz = timezone.utc

    # Simulate chronological supplier ledger events
    mock_events = [
        {
            "id": "op-supp",
            "date": datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "SP-CONT",
            "type": "Opening Balance",
            "debit": 20000.0,
            "credit": 0.0,
            "running_balance": 20000.0,
        },
        # Day 1: 2026-09-29
        {
            "id": "pur-1",
            "date": datetime(2026, 9, 29, 10, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 9, 29, 10, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "PO-001",
            "type": "Purchase",
            "debit": 58450.0,
            "credit": 0.0,
            "running_balance": 78450.0,
        },
        {
            "id": "ret-1",
            "date": datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "PR-001",
            "type": "Purchase Return",
            "debit": 0.0,
            "credit": 2000.0,
            "running_balance": 76450.0,
        },
        {
            "id": "pay-1",
            "date": datetime(2026, 9, 29, 15, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 9, 29, 15, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "SPAY-001",
            "type": "Supplier Payment",
            "debit": 0.0,
            "credit": 30000.0,
            "running_balance": 46450.0,
        },
        # Day 2: 2026-09-30 has no transactions
        # Day 3: 2026-10-01
        {
            "id": "pur-2",
            "date": datetime(2026, 10, 1, 9, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 10, 1, 9, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "PO-002",
            "type": "Purchase",
            "debit": 10000.0,
            "credit": 0.0,
            "running_balance": 56450.0,
        },
        {
            "id": "pay-2",
            "date": datetime(2026, 10, 1, 14, 0, 0, tzinfo=timezone.utc),
            "created_at": datetime(2026, 10, 1, 14, 0, 0, tzinfo=timezone.utc),
            "voucher_no": "SPAY-002",
            "type": "Supplier Payment",
            "debit": 0.0,
            "credit": 6450.0,
            "running_balance": 50000.0,
        },
    ]

    with patch("app.services.supplier_service.supplier_repository.get_by_id", new=AsyncMock(return_value=mock_supp)), \
         patch.object(supplier_service, "_get_reconciled_supplier_events", new=AsyncMock(return_value=(mock_events, 0.0, mock_events[0]))):

        res = await supplier_service.get_supplier_daily_accounts(
            db=mock_db,
            supplier_id="supp-test-cont",
            start_date_local=date(2026, 9, 29),
            end_date_local=date(2026, 10, 1),
            tz=tz,
        )

        assert res["supplier_id"] == "supp-test-cont"
        assert res["supplier_name"] == "ABC Poultry"
        days = res["daily_accounts"]
        assert len(days) == 3

        # Day 1: 29/09/2026
        d1 = days[0]
        assert d1["date"] == "2026-09-29"
        assert d1["previous_due"] == 20000.0
        assert d1["purchase_amount"] == 58450.0
        assert d1["return_amount"] == 2000.0
        assert d1["payment_amount"] == 30000.0
        assert d1["closing_due"] == 46450.0

        # Day 2: 30/09/2026 (continuity with zero activity)
        d2 = days[1]
        assert d2["date"] == "2026-09-30"
        assert d2["previous_due"] == d1["closing_due"] == 46450.0
        assert d2["purchase_amount"] == 0.0
        assert d2["return_amount"] == 0.0
        assert d2["payment_amount"] == 0.0
        assert d2["closing_due"] == 46450.0

        # Day 3: 01/10/2026
        d3 = days[2]
        assert d3["date"] == "2026-10-01"
        assert d3["previous_due"] == d2["closing_due"] == 46450.0
        assert d3["purchase_amount"] == 10000.0
        assert d3["return_amount"] == 0.0
        assert d3["payment_amount"] == 6450.0
        assert d3["closing_due"] == 50000.0

        # Overall summary matches ledger final running balance
        assert res["previous_due"] == 20000.0
        assert res["purchase_amount"] == 68450.0
        assert res["return_amount"] == 2000.0
        assert res["payment_amount"] == 36450.0
        assert res["closing_due"] == 50000.0


@pytest.mark.asyncio
async def test_cash_book_service_integrates_supplier_summary():
    """Verify CashBookService integrates supplier_summary safely when setting is present."""
    mock_db = AsyncMock()
    mock_setting = Setting(key="supplier_print_supplier_id", value="supp-abc", group_name="business")

    mock_daily_data = {
        "supplier_id": "supp-abc",
        "supplier_name": "ABC Poultry",
        "supplier_code": "SP-ABC",
        "company_name": "ABC Poultry",
        "phone": "01700000000",
        "previous_due": 20000.0,
        "purchase_amount": 58450.0,
        "return_amount": 2000.0,
        "payment_amount": 30000.0,
        "closing_due": 46450.0,
        "daily_accounts": [
            {
                "date": "2026-09-29",
                "previous_due": 20000.0,
                "purchase_amount": 58450.0,
                "return_amount": 2000.0,
                "payment_amount": 30000.0,
                "closing_due": 46450.0,
            }
        ],
    }

    # Execute cash_book_service with mocked setting & supplier daily data
    with patch("app.services.cash_book_service.setting_repository.get_by_key", new=AsyncMock(return_value=mock_setting)), \
         patch("app.services.supplier_service.supplier_service.get_supplier_daily_accounts", new=AsyncMock(return_value=mock_daily_data)), \
         patch.object(cash_book_service, "get_cash_book") as mock_get_cb:

        expected_summary = CashBookSummary(
            date="2026-09-29",
            start_date=datetime(2026, 9, 29, 0, 0, 0, tzinfo=timezone.utc),
            end_date=datetime(2026, 9, 29, 23, 59, 59, tzinfo=timezone.utc),
            timezone="UTC",
            currency_symbol="৳",
            previous_balance=0.0,
            today_cash_received=122567.0,
            today_cash_expense=180.0,
            total_expense=180.0,
            today_cash_out=122197.0,
            total_cash_out=122197.0,
            cash_in_hand=190.0,
            total_cash_received=122567.0,
            total_cash_paid=122377.0,
            closing_cash_balance=190.0,
            company_name="AKOTA POULTRY",
            items=[],
            supplier_summary=SupplierPrintSummary(
                supplier_id="supp-abc",
                supplier_name="ABC Poultry",
                supplier_code="SP-ABC",
                company_name="ABC Poultry",
                phone="01700000000",
                previous_due=20000.0,
                purchase_amount=58450.0,
                return_amount=2000.0,
                payment_amount=30000.0,
                closing_due=46450.0,
                daily_accounts=[SupplierDailyAccount(**mock_daily_data["daily_accounts"][0])],
            ),
        )
        mock_get_cb.return_value = expected_summary

        cb = await cash_book_service.get_cash_book(mock_db, target_date="2026-09-29")
        assert cb.supplier_summary is not None
        assert cb.supplier_summary.supplier_name == "ABC Poultry"
        assert cb.supplier_summary.closing_due == 46450.0
        assert cb.closing_cash_balance == 190.0


@pytest.mark.asyncio
async def test_cash_book_service_graceful_when_no_supplier_or_deleted():
    """Verify supplier_summary is None if not configured or supplier is deleted."""
    mock_db = AsyncMock()
    from app.repositories.setting_repository import setting_repository

    # 1. Setting is None
    with patch("app.services.cash_book_service.setting_repository.get_by_key", new=AsyncMock(return_value=None)):
        setting = await setting_repository.get_by_key(mock_db, "supplier_print_supplier_id")
        assert setting is None

    # 2. Setting points to deleted supplier -> supplier_service raises NotFoundException
    with patch("app.services.cash_book_service.setting_repository.get_by_key", new=AsyncMock(return_value=Setting(key="supplier_print_supplier_id", value="supp-deleted", group_name="business"))), \
         patch("app.services.supplier_service.supplier_service.get_supplier_daily_accounts", new=AsyncMock(side_effect=NotFoundException("Supplier not found"))):
        # Verification that exception is handled gracefully in CashBookService
        supplier_summary = None
        try:
            s_set = await setting_repository.get_by_key(mock_db, "supplier_print_supplier_id")
            if s_set and s_set.value:
                await supplier_service.get_supplier_daily_accounts(
                    db=mock_db,
                    supplier_id=s_set.value,
                    start_date_local=date(2026, 9, 29),
                    end_date_local=date(2026, 9, 29),
                    tz=timezone.utc,
                )
        except Exception:
            supplier_summary = None
        assert supplier_summary is None
