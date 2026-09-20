from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Union
import zoneinfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.datetime_utils import normalize_date_range
from app.models.currency import Currency
from app.models.customer_collection import CustomerCollection
from app.models.expense import Expense
from app.models.purchase import Purchase
from app.models.sale import Sale
from app.models.sale_return import SaleReturn
from app.models.supplier_payment import SupplierPayment
from app.schemas.cash_book import CashBookItem, CashBookSummary
from app.services.setting_service import setting_service


class CashBookService:
    """
    Authoritative Financial Service for Daily Cash Book & Cash Ledger.
    Tracks all actual physical CASH inflows and outflows using Decimal precision.
    """

    async def get_cash_book(
        self,
        db: AsyncSession,
        target_date: Optional[Union[date, str]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> CashBookSummary:
        # 1. Fetch business configuration (Timezone, Currency, Business Profile)
        settings = await setting_service.get_business_settings(db)
        tz_str = settings.timezone or "UTC"
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc

        currency_symbol = "৳"
        if settings.default_currency_id:
            curr = (await db.execute(select(Currency).where(Currency.id == settings.default_currency_id))).scalar_one_or_none()
            if curr:
                currency_symbol = curr.symbol
        else:
            curr = (await db.execute(select(Currency).where(Currency.is_default == True))).scalar_one_or_none()
            if curr:
                currency_symbol = curr.symbol

        # 2. Determine target business date and UTC boundaries
        if target_date is not None:
            if isinstance(target_date, str):
                target_date_clean = target_date.strip().split("T")[0]
                target_d = date.fromisoformat(target_date_clean)
            else:
                target_d = target_date

            start_dt_local = datetime(target_d.year, target_d.month, target_d.day, 0, 0, 0, 0, tzinfo=tz)
            end_dt_local = datetime(target_d.year, target_d.month, target_d.day, 23, 59, 59, 999999, tzinfo=tz)
            start_utc = start_dt_local.astimezone(timezone.utc)
            end_utc = end_dt_local.astimezone(timezone.utc)
            display_date = target_d.strftime("%Y-%m-%d")
        elif start_date is not None or end_date is not None:
            norm_start, norm_end = normalize_date_range(start_date, end_date, tz_str=tz_str, default_to_today=True)
            start_utc = norm_start or datetime.now(timezone.utc)
            end_utc = norm_end or datetime.now(timezone.utc)
            s_loc = start_utc.astimezone(tz)
            e_loc = end_utc.astimezone(tz)
            if s_loc.date() == e_loc.date():
                display_date = s_loc.strftime("%Y-%m-%d")
            else:
                display_date = f"{s_loc.strftime('%Y-%m-%d')} to {e_loc.strftime('%Y-%m-%d')}"
        else:
            # Default to today in business timezone
            now_tz = datetime.now(tz)
            today_d = now_tz.date()
            start_dt_local = datetime(today_d.year, today_d.month, today_d.day, 0, 0, 0, 0, tzinfo=tz)
            end_dt_local = datetime(today_d.year, today_d.month, today_d.day, 23, 59, 59, 999999, tzinfo=tz)
            start_utc = start_dt_local.astimezone(timezone.utc)
            end_utc = end_dt_local.astimezone(timezone.utc)
            display_date = today_d.strftime("%Y-%m-%d")

        # 3. Calculate Previous / Opening Balance (Strictly before start_utc)
        # Inflows before start_utc:
        # a) Cash portion of sales
        q_prev_sales = select(func.coalesce(func.sum(Sale.paid_amount), 0.0)).where(
            Sale.sale_date < start_utc,
            Sale.paid_amount > 0,
        )
        prev_sales_in = Decimal(str((await db.execute(q_prev_sales)).scalar() or 0.0))

        # b) Customer Collections in cash
        q_prev_collections = select(func.coalesce(func.sum(CustomerCollection.amount), 0.0)).where(
            CustomerCollection.collection_date < start_utc,
            CustomerCollection.amount > 0,
            func.lower(func.coalesce(CustomerCollection.payment_method, "cash")) == "cash",
        )
        prev_col_in = Decimal(str((await db.execute(q_prev_collections)).scalar() or 0.0))

        # Outflows before start_utc:
        # c) Expenses in cash
        q_prev_expenses = select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
            Expense.expense_date < start_utc,
            Expense.amount > 0,
            func.lower(func.coalesce(Expense.payment_method, "cash")) == "cash",
        )
        prev_exp_out = Decimal(str((await db.execute(q_prev_expenses)).scalar() or 0.0))

        # d) Supplier payments in cash
        q_prev_supplier_payments = select(func.coalesce(func.sum(SupplierPayment.amount), 0.0)).where(
            SupplierPayment.payment_date < start_utc,
            SupplierPayment.amount > 0,
            func.lower(func.coalesce(SupplierPayment.payment_method, "cash")) == "cash",
        )
        prev_spay_out = Decimal(str((await db.execute(q_prev_supplier_payments)).scalar() or 0.0))

        # e) Cash paid on purchases
        q_prev_purchases = select(func.coalesce(func.sum(Purchase.paid_amount), 0.0)).where(
            Purchase.purchase_date < start_utc,
            Purchase.paid_amount > 0,
        )
        prev_pur_out = Decimal(str((await db.execute(q_prev_purchases)).scalar() or 0.0))

        # f) Sale return cash refunds
        q_prev_returns = select(func.coalesce(func.sum(SaleReturn.refund_amount), 0.0)).where(
            SaleReturn.return_date < start_utc,
            SaleReturn.refund_amount > 0,
        )
        prev_ret_out = Decimal(str((await db.execute(q_prev_returns)).scalar() or 0.0))

        total_prev_inflows = prev_sales_in + prev_col_in
        total_prev_outflows = prev_exp_out + prev_spay_out + prev_pur_out + prev_ret_out
        previous_balance_dec = (total_prev_inflows - total_prev_outflows).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # 4. Query transactions within [start_utc, end_utc]
        raw_transactions = []

        # A. Sales (Cash Received)
        q_curr_sales = (
            select(Sale)
            .options(selectinload(Sale.customer))
            .where(
                Sale.sale_date >= start_utc,
                Sale.sale_date <= end_utc,
                Sale.paid_amount > 0,
            )
        )
        sales_records = (await db.execute(q_curr_sales)).scalars().all()
        for s in sales_records:
            cust_name = s.customer.name if s.customer else "Walk-in Customer"
            cust_code = s.customer.customer_code if (s.customer and s.customer.customer_code) else "—"
            raw_transactions.append({
                "id": f"sale-{s.id}",
                "timestamp": s.sale_date,
                "description": "Sale Product in Cash",
                "code": cust_code,
                "name": cust_name,
                "invoice": s.invoice_no,
                "transaction_type": "cash_sale",
                "debit": Decimal("0.00"),
                "credit": Decimal(str(s.paid_amount)),
            })

        # B. Customer Collections (Cash Received)
        q_curr_cols = (
            select(CustomerCollection)
            .options(selectinload(CustomerCollection.customer))
            .where(
                CustomerCollection.collection_date >= start_utc,
                CustomerCollection.collection_date <= end_utc,
                CustomerCollection.amount > 0,
                func.lower(func.coalesce(CustomerCollection.payment_method, "cash")) == "cash",
            )
        )
        col_records = (await db.execute(q_curr_cols)).scalars().all()
        for c in col_records:
            cust_name = c.customer.name if c.customer else "Customer"
            cust_code = c.customer.customer_code if (c.customer and c.customer.customer_code) else (c.reference_no or "—")
            raw_transactions.append({
                "id": f"col-{c.id}",
                "timestamp": c.collection_date,
                "description": "Customer Collection",
                "code": cust_code,
                "name": cust_name,
                "invoice": c.collection_no,
                "transaction_type": "collection",
                "debit": Decimal("0.00"),
                "credit": Decimal(str(c.amount)),
            })

        # C. Expenses (Cash Outflow)
        q_curr_expenses = (
            select(Expense)
            .options(selectinload(Expense.category))
            .where(
                Expense.expense_date >= start_utc,
                Expense.expense_date <= end_utc,
                Expense.amount > 0,
                func.lower(func.coalesce(Expense.payment_method, "cash")) == "cash",
            )
        )
        exp_records = (await db.execute(q_curr_expenses)).scalars().all()
        for e in exp_records:
            cat_name = e.category.name if e.category else "Expense"
            raw_transactions.append({
                "id": f"exp-{e.id}",
                "timestamp": e.expense_date,
                "description": f"Expense - {cat_name}" if cat_name != "Expense" else "Expense",
                "code": e.reference_no or "—",
                "name": cat_name,
                "invoice": e.voucher_no,
                "transaction_type": "expense",
                "debit": Decimal(str(e.amount)),
                "credit": Decimal("0.00"),
            })

        # D. Supplier Payments (Cash Outflow)
        q_curr_spay = (
            select(SupplierPayment)
            .options(selectinload(SupplierPayment.supplier))
            .where(
                SupplierPayment.payment_date >= start_utc,
                SupplierPayment.payment_date <= end_utc,
                SupplierPayment.amount > 0,
                func.lower(func.coalesce(SupplierPayment.payment_method, "cash")) == "cash",
            )
        )
        spay_records = (await db.execute(q_curr_spay)).scalars().all()
        for sp in spay_records:
            supp_name = sp.supplier.name if sp.supplier else "Supplier"
            supp_code = sp.supplier.supplier_code if (sp.supplier and sp.supplier.supplier_code) else (sp.reference_no or "—")
            raw_transactions.append({
                "id": f"spay-{sp.id}",
                "timestamp": sp.payment_date,
                "description": "Supplier Payment",
                "code": supp_code,
                "name": supp_name,
                "invoice": sp.payment_no,
                "transaction_type": "supplier_payment",
                "debit": Decimal(str(sp.amount)),
                "credit": Decimal("0.00"),
            })

        # E. Purchases (Cash Paid on Purchase)
        q_curr_purchases = (
            select(Purchase)
            .options(selectinload(Purchase.supplier))
            .where(
                Purchase.purchase_date >= start_utc,
                Purchase.purchase_date <= end_utc,
                Purchase.paid_amount > 0,
            )
        )
        purchase_records = (await db.execute(q_curr_purchases)).scalars().all()
        for p in purchase_records:
            supp_name = p.supplier.name if p.supplier else "Supplier"
            supp_code = p.supplier.supplier_code if (p.supplier and p.supplier.supplier_code) else (p.invoice_no or "—")
            raw_transactions.append({
                "id": f"pur-{p.id}",
                "timestamp": p.purchase_date,
                "description": "Purchase in Cash",
                "code": supp_code,
                "name": supp_name,
                "invoice": p.purchase_no,
                "transaction_type": "cash_purchase",
                "debit": Decimal(str(p.paid_amount)),
                "credit": Decimal("0.00"),
            })

        # F. Sale Return Cash Refunds (Cash Outflow)
        q_curr_returns = (
            select(SaleReturn)
            .options(selectinload(SaleReturn.customer))
            .where(
                SaleReturn.return_date >= start_utc,
                SaleReturn.return_date <= end_utc,
                SaleReturn.refund_amount > 0,
            )
        )
        ret_records = (await db.execute(q_curr_returns)).scalars().all()
        for r in ret_records:
            cust_name = r.customer.name if r.customer else "Customer"
            cust_code = r.customer.customer_code if (r.customer and r.customer.customer_code) else "—"
            raw_transactions.append({
                "id": f"ret-{r.id}",
                "timestamp": r.return_date,
                "description": "Sale Return Refund",
                "code": cust_code,
                "name": cust_name,
                "invoice": r.return_no,
                "transaction_type": "sale_return_refund",
                "debit": Decimal(str(r.refund_amount)),
                "credit": Decimal("0.00"),
            })

        # 5. Sort transactions chronologically
        raw_transactions.sort(key=lambda item: (item["timestamp"], item["id"]))

        # 6. Build formatted Cash Book Items with Running Balance
        items: List[CashBookItem] = []
        running_balance = previous_balance_dec
        total_credit_dec = Decimal("0.00")
        total_debit_dec = Decimal("0.00")

        # Opening row for Previous Balance
        start_local_dt = start_utc.astimezone(tz)
        opening_item = CashBookItem(
            id="opening-balance",
            date=start_utc,
            formatted_date=start_local_dt.strftime("%d-%m-%Y"),
            formatted_time="—",
            description="Previous Balance",
            code="—",
            name="—",
            invoice="—",
            transaction_type="opening_balance",
            debit=0.0,
            credit=0.0,
            balance=float(previous_balance_dec),
        )
        items.append(opening_item)

        for tx in raw_transactions:
            credit_val = tx["credit"]
            debit_val = tx["debit"]
            total_credit_dec += credit_val
            total_debit_dec += debit_val

            running_balance = (running_balance + credit_val - debit_val).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

            tx_local_dt = tx["timestamp"].astimezone(tz)
            items.append(
                CashBookItem(
                    id=tx["id"],
                    date=tx["timestamp"],
                    formatted_date=tx_local_dt.strftime("%d-%m-%Y"),
                    formatted_time=tx_local_dt.strftime("%I:%M %p"),
                    description=tx["description"],
                    code=tx["code"],
                    name=tx["name"],
                    invoice=tx["invoice"],
                    transaction_type=tx["transaction_type"],
                    debit=float(debit_val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                    credit=float(credit_val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                    balance=float(running_balance),
                )
            )

        closing_cash_dec = (previous_balance_dec + total_credit_dec - total_debit_dec).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        return CashBookSummary(
            date=display_date,
            start_date=start_utc,
            end_date=end_utc,
            timezone=tz_str,
            currency_symbol=currency_symbol,
            previous_balance=float(previous_balance_dec),
            today_cash_received=float(total_credit_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            today_cash_expense=float(total_debit_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            cash_in_hand=float(closing_cash_dec),
            total_cash_received=float(total_credit_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            total_cash_paid=float(total_debit_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            closing_cash_balance=float(closing_cash_dec),
            company_name=settings.business_name,
            company_address=settings.business_address,
            company_phone=settings.business_phone,
            company_logo=settings.business_logo,
            items=items,
        )


cash_book_service = CashBookService()
