from datetime import date, datetime, timezone
import math
import zoneinfo
from typing import Optional, Sequence
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

# Centralized baseline cutoff date for historical ledger reconciliation
RECONCILIATION_BASELINE_DATE = date(2026, 9, 23)

from app.core.datetime_utils import normalize_date_range
from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier_payment import SupplierPayment
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.balance_adjustment import BalanceAdjustment
from app.models.supplier_other_transaction import SupplierOtherTransaction
from app.repositories.supplier_repository import supplier_repository
from app.schemas.supplier import SupplierCreate, SupplierUpdate
from app.services.setting_service import setting_service


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class SupplierService:
    async def create_supplier(self, db: AsyncSession, supplier_in: SupplierCreate) -> Supplier:
        # Supplier code handling
        if supplier_in.supplier_code and supplier_in.supplier_code.strip():
            existing_code = await supplier_repository.get_by_code(db, supplier_in.supplier_code.strip())
            if existing_code:
                raise ConflictException(f"Supplier code '{supplier_in.supplier_code}' is already in use.")
            code = supplier_in.supplier_code.strip()
        else:
            code = await supplier_repository.generate_supplier_code(db)

        supplier_data = supplier_in.model_dump()
        supplier_data["supplier_code"] = code
        if supplier_in.phone and supplier_in.phone.strip():
            supplier_data["phone"] = supplier_in.phone.strip()
        else:
            supplier_data["phone"] = None

        # Opening Due automatically initializes current_balance
        supplier_data["current_balance"] = supplier_in.opening_balance or 0.0

        return await supplier_repository.create(db, obj_in=supplier_data)

    async def update_supplier(self, db: AsyncSession, supplier_id: str, supplier_in: SupplierUpdate) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        update_data = supplier_in.model_dump(exclude_unset=True)
        if "phone" in update_data and update_data["phone"]:
            update_data["phone"] = update_data["phone"].strip()

        return await supplier_repository.update(db, db_obj=supplier, obj_in=update_data)

    async def update_supplier_status(self, db: AsyncSession, supplier_id: str, new_status: str) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        if new_status not in ["active", "inactive"]:
            raise BadRequestException("Invalid supplier status. Allowed values: active, inactive")

        return await supplier_repository.update(db, db_obj=supplier, obj_in={"status": new_status})

    async def get_supplier(self, db: AsyncSession, supplier_id: str) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")
        return supplier

    async def get_suppliers_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        due_only: bool = False,
    ) -> tuple[Sequence[Supplier], int]:
        return await supplier_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, status=status, due_only=due_only
        )

    async def delete_supplier(self, db: AsyncSession, supplier_id: str) -> bool:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        await db.delete(supplier)
        await db.commit()
        return True

    async def hard_delete_supplier(self, db: AsyncSession, supplier_id: str) -> bool:
        """
        Permanently hard deletes a supplier and all dependent records in correct cascade order:
        1. ProductReturnItems & ProductReturns
        2. PurchaseItems & Purchases
        3. SupplierPayments
        4. BalanceAdjustments
        5. Supplier record
        """
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        # 1. Delete ProductReturnItems and ProductReturns
        returns_q = select(ProductReturn.id).where(ProductReturn.supplier_id == supplier_id)
        returns_res = await db.execute(returns_q)
        return_ids = returns_res.scalars().all()
        if return_ids:
            await db.execute(delete(ProductReturnItem).where(ProductReturnItem.product_return_id.in_(return_ids)))
            await db.execute(delete(ProductReturn).where(ProductReturn.id.in_(return_ids)))

        # 2. Delete PurchaseItems and Purchases
        purchases_q = select(Purchase.id).where(Purchase.supplier_id == supplier_id)
        purchases_res = await db.execute(purchases_q)
        purchase_ids = purchases_res.scalars().all()
        if purchase_ids:
            await db.execute(delete(PurchaseItem).where(PurchaseItem.purchase_id.in_(purchase_ids)))
            await db.execute(delete(Purchase).where(Purchase.id.in_(purchase_ids)))

        # 3. Delete SupplierPayments
        await db.execute(delete(SupplierPayment).where(SupplierPayment.supplier_id == supplier_id))

        # 4. Delete BalanceAdjustments
        await db.execute(
            delete(BalanceAdjustment).where(
                BalanceAdjustment.entity_type == "supplier",
                BalanceAdjustment.entity_id == supplier_id,
            )
        )

        # 5. Delete SupplierOtherTransactions
        await db.execute(delete(SupplierOtherTransaction).where(SupplierOtherTransaction.supplier_id == supplier_id))

        await db.delete(supplier)
        await db.commit()
        return True

    async def _get_reconciled_supplier_events(
        self, db: AsyncSession, supplier: Supplier, tz: zoneinfo.ZoneInfo
    ) -> tuple[list[dict], float, dict]:
        supplier_id = supplier.id

        # 1. Fetch Purchases
        purchases_res = await db.execute(
            select(Purchase).where(Purchase.supplier_id == supplier_id).order_by(Purchase.purchase_date.asc())
        )
        purchases = purchases_res.scalars().all()

        # 2. Fetch Supplier Payments
        payments_res = await db.execute(
            select(SupplierPayment).where(SupplierPayment.supplier_id == supplier_id).order_by(SupplierPayment.payment_date.asc())
        )
        payments = payments_res.scalars().all()

        # 3. Fetch Product Returns
        returns_res = await db.execute(
            select(ProductReturn).where(ProductReturn.supplier_id == supplier_id).order_by(ProductReturn.return_date.asc())
        )
        returns = returns_res.scalars().all()

        # 4. Fetch Balance Adjustments
        adjustments = []
        try:
            adjs_res = await db.execute(
                select(BalanceAdjustment).where(
                    BalanceAdjustment.entity_type == "supplier",
                    BalanceAdjustment.entity_id == supplier_id,
                ).order_by(BalanceAdjustment.effective_date.asc())
            )
            adjustments = adjs_res.scalars().all()
        except Exception:
            adjustments = []

        # 5. Fetch Supplier Other Transactions
        other_txs = []
        try:
            other_txs_res = await db.execute(
                select(SupplierOtherTransaction).where(
                    SupplierOtherTransaction.supplier_id == supplier_id
                ).order_by(SupplierOtherTransaction.transaction_date.asc())
            )
            other_txs = other_txs_res.scalars().all()
        except Exception:
            other_txs = []

        baseline_start_tz = datetime(
            RECONCILIATION_BASELINE_DATE.year,
            RECONCILIATION_BASELINE_DATE.month,
            RECONCILIATION_BASELINE_DATE.day,
            0, 0, 0, 0,
            tzinfo=tz,
        )
        baseline_start_utc = baseline_start_tz.astimezone(timezone.utc)

        # Existing payment purchase_ids to prevent double counting
        existing_payment_purchase_ids = {p.purchase_id for p in payments if p.purchase_id}

        # Gather operational events first
        operational_events = []

        # 1. Purchases events
        for purchase in purchases:
            operational_events.append({
                "id": f"pur-{purchase.id}",
                "date": purchase.purchase_date,
                "created_at": purchase.created_at,
                "voucher_no": purchase.purchase_no,
                "type": "Purchase",
                "description": f"Purchase Order ({len(purchase.items)} items)" + (f" - Inv #{purchase.invoice_no}" if purchase.invoice_no else ""),
                "debit": purchase.grand_total,
                "credit": 0.0,
                "reference_id": purchase.id,
                "reference_type": "purchase",
            })
            if purchase.paid_amount > 0 and purchase.id not in existing_payment_purchase_ids:
                operational_events.append({
                    "id": f"pur-pay-{purchase.id}",
                    "date": purchase.purchase_date,
                    "created_at": purchase.created_at,
                    "voucher_no": purchase.purchase_no,
                    "type": "Supplier Payment",
                    "description": f"Immediate payment for purchase {purchase.purchase_no}",
                    "debit": 0.0,
                    "credit": purchase.paid_amount,
                    "reference_id": purchase.id,
                    "reference_type": "purchase",
                })

        # 2. Supplier Payment events
        for sp in payments:
            pm = sp.payment_method.replace("_", " ").title()
            operational_events.append({
                "id": f"sp-{sp.id}",
                "date": sp.payment_date,
                "created_at": sp.created_at,
                "voucher_no": sp.payment_no,
                "type": "Supplier Payment",
                "description": f"Supplier Payment ({pm}){f' - {sp.notes}' if sp.notes else ''}",
                "debit": 0.0,
                "credit": sp.amount,
                "reference_id": sp.id,
                "reference_type": "supplier_payment",
            })

        # 3. Return events
        for ret in returns:
            net_return = ret.grand_total - (ret.refund_received or 0.0)
            operational_events.append({
                "id": f"ret-{ret.id}",
                "date": ret.return_date,
                "created_at": ret.created_at,
                "voucher_no": ret.return_no,
                "type": "Purchase Return",
                "description": f"Purchase Return{f' for purchase {ret.purchase.purchase_no}' if ret.purchase else ''}{f' (Refund: {ret.refund_received})' if ret.refund_received > 0 else ''}",
                "debit": 0.0,
                "credit": net_return,
                "reference_id": ret.id,
                "reference_type": "product_return",
            })

        # 4. Balance Adjustment events
        for adj in adjustments:
            adj_date_utc = _to_utc(adj.effective_date)
            if not adj_date_utc or adj_date_utc < baseline_start_utc:
                continue

            adj_debit = adj.difference if adj.difference > 0 else 0.0
            adj_credit = abs(adj.difference) if adj.difference < 0 else 0.0
            operational_events.append({
                "id": f"adj-{adj.id}",
                "date": adj.effective_date,
                "created_at": adj.created_at,
                "voucher_no": f"ADJ-{adj.id[:8].upper()}",
                "type": "Balance Adjustment",
                "description": f"{adj.reason}{f' - {adj.notes}' if adj.notes else ''}",
                "debit": adj_debit,
                "credit": adj_credit,
                "reference_id": adj.id,
                "reference_type": "balance_adjustment",
            })

        # 5. Other Transaction events
        for ot in other_txs:
            debit_amt = ot.amount if ot.transaction_type == "other_payable" else 0.0
            credit_amt = ot.amount if ot.transaction_type != "other_payable" else 0.0
            operational_events.append({
                "id": f"sot-{ot.id}",
                "date": ot.transaction_date,
                "created_at": ot.created_at,
                "voucher_no": ot.voucher_no,
                "type": "Other Payable",
                "description": f"Other Payable{f' (Ref: {ot.reference_no})' if ot.reference_no else ''}{f' - {ot.notes}' if ot.notes else ''}",
                "debit": debit_amt,
                "credit": credit_amt,
                "reference_id": ot.id,
                "reference_type": "supplier_other_transaction",
            })

        # 6. Opening Balance event
        supp_created_utc = _to_utc(supplier.created_at)
        if operational_events:
            earliest_op_date = min(
                (_to_utc(ev["date"]) for ev in operational_events if ev.get("date")),
                default=supp_created_utc,
            )
        else:
            earliest_op_date = supp_created_utc

        op_date = min(supp_created_utc, earliest_op_date)
        op_debit = supplier.opening_balance if supplier.opening_balance > 0 else 0.0
        op_credit = abs(supplier.opening_balance) if supplier.opening_balance < 0 else 0.0

        op_event = {
            "id": f"op-{supplier.id}",
            "date": op_date,
            "created_at": supp_created_utc,
            "voucher_no": supplier.supplier_code,
            "type": "Opening Balance",
            "description": "Initial Supplier Opening Balance",
            "debit": op_debit,
            "credit": op_credit,
            "reference_id": supplier.id,
            "reference_type": None,
        }

        raw_events = [op_event] + operational_events

        def _event_sort_key(x):
            d = _to_utc(x["date"]) or datetime.min.replace(tzinfo=timezone.utc)
            type_order = {
                "Opening Balance": 0,
                "Purchase": 1,
                "Other Payable": 2,
                "Supplier Payment": 3,
                "Purchase Return": 4,
                "Balance Adjustment": 5,
            }.get(x["type"], 6)
            c = _to_utc(x.get("created_at")) or d
            v = x.get("voucher_no") or ""
            ref = str(x.get("reference_id") or "")
            return (d, type_order, c, v, ref)

        raw_events.sort(key=_event_sort_key)

        reconstructed_balance_without_hidden_adjustments = round(
            sum(ev["debit"] - ev["credit"] for ev in raw_events), 2
        )

        reconciliation_offset = round(
            supplier.current_balance - reconstructed_balance_without_hidden_adjustments, 2
        )

        running_bal = 0.0
        all_calculated_events = []
        for ev in raw_events:
            running_bal = round(running_bal + ev["debit"] - ev["credit"], 2)
            ev_copy = dict(ev)
            ev_copy["running_balance"] = round(running_bal + reconciliation_offset, 2)
            all_calculated_events.append(ev_copy)

        return all_calculated_events, reconciliation_offset, op_event

    async def get_supplier_ledger(
        self,
        db: AsyncSession,
        supplier_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> dict:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        try:
            bs = await setting_service.get_business_settings(db)
            tz_str = bs.timezone or "Asia/Dhaka"
        except Exception:
            tz_str = "Asia/Dhaka"

        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc

        all_events, reconciliation_offset, op_event = await self._get_reconciled_supplier_events(
            db, supplier, tz
        )

        total_purchases = 0.0
        total_other_payables = 0.0
        total_payments = 0.0
        total_returns = 0.0
        manual_adjustments = 0.0

        start_utc = _to_utc(start_date)
        end_utc = _to_utc(end_date)
        calculated_events = []

        for ev in all_events:
            if ev["type"] == "Purchase":
                total_purchases += ev["debit"]
            elif ev["type"] == "Other Payable":
                total_other_payables += ev["debit"]
            elif ev["type"] == "Supplier Payment":
                total_payments += ev["credit"]
            elif ev["type"] == "Purchase Return":
                total_returns += ev["credit"]
            elif ev["type"] == "Balance Adjustment":
                manual_adjustments += (ev["debit"] - ev["credit"])

            ev_date_utc = _to_utc(ev["date"])
            if start_utc and ev_date_utc and ev_date_utc < start_utc:
                continue
            if end_utc and ev_date_utc and ev_date_utc > end_utc:
                continue

            calculated_events.append(ev)

        effective_op_balance = round(supplier.opening_balance + reconciliation_offset, 2)
        summary = {
            "opening_balance": effective_op_balance,
            "total_purchases": round(total_purchases, 2),
            "total_other_payables": round(total_other_payables, 2),
            "total_payments": round(total_payments, 2),
            "total_returns": round(total_returns, 2),
            "manual_adjustments": round(manual_adjustments, 2),
            "current_due": round(supplier.current_balance, 2),
        }

        total = len(calculated_events)
        if page is not None or page_size is not None:
            p = max(1, page or 1)
            ps = max(1, min(100, page_size or 25))
            pages = math.ceil(total / ps) if total > 0 else 0
            start_idx = (p - 1) * ps
            end_idx = start_idx + ps
            paginated_events = calculated_events[start_idx:end_idx]
            ret_page = p
            ret_page_size = ps
            ret_pages = pages
        else:
            paginated_events = calculated_events
            ret_page = 1
            ret_page_size = total if total > 0 else 25
            ret_pages = 1 if total > 0 else 0

        return {
            "supplier": supplier,
            "summary": summary,
            "transactions": paginated_events,
            "total": total,
            "page": ret_page,
            "page_size": ret_page_size,
            "pages": ret_pages,
        }

    async def get_supplier_daily_accounts(
        self,
        db: AsyncSession,
        supplier_id: str,
        start_date_local: date,
        end_date_local: date,
        tz: zoneinfo.ZoneInfo,
    ) -> dict:
        from datetime import timedelta
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        all_events, reconciliation_offset, op_event = await self._get_reconciled_supplier_events(
            db, supplier, tz
        )

        if start_date_local > end_date_local:
            start_date_local, end_date_local = end_date_local, start_date_local

        day_list = []
        cur_d = start_date_local
        while cur_d <= end_date_local:
            day_list.append(cur_d)
            cur_d += timedelta(days=1)

        first_day_start_local = datetime(
            day_list[0].year, day_list[0].month, day_list[0].day, 0, 0, 0, 0, tzinfo=tz
        )
        first_day_start_utc = first_day_start_local.astimezone(timezone.utc)

        initial_due = round(supplier.opening_balance + reconciliation_offset, 2)
        op_events_only = [ev for ev in all_events if ev.get("type") != "Opening Balance"]

        events_before = [
            ev for ev in op_events_only
            if (_to_utc(ev.get("date")) or datetime.min.replace(tzinfo=timezone.utc)) < first_day_start_utc
        ]
        if events_before:
            current_running_due = round(events_before[-1]["running_balance"], 2)
        else:
            current_running_due = initial_due

        daily_accounts = []
        for d in day_list:
            day_start_local = datetime(d.year, d.month, d.day, 0, 0, 0, 0, tzinfo=tz)
            day_end_local = datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=tz)
            day_start_utc = day_start_local.astimezone(timezone.utc)
            day_end_utc = day_end_local.astimezone(timezone.utc)

            day_events = [
                ev for ev in all_events
                if day_start_utc <= (_to_utc(ev.get("date")) or datetime.min.replace(tzinfo=timezone.utc)) <= day_end_utc
            ]

            day_purchases = 0.0
            day_returns = 0.0
            day_payments = 0.0
            day_other = 0.0
            day_adjustments = 0.0

            for ev in day_events:
                t = ev.get("type")
                if t == "Opening Balance":
                    # Initial debt is already captured in previous_due
                    continue
                elif t == "Purchase":
                    day_purchases += ev.get("debit", 0.0)
                elif t == "Other Payable":
                    day_other += ev.get("debit", 0.0)
                    day_payments += ev.get("credit", 0.0)
                elif t == "Supplier Payment":
                    day_payments += ev.get("credit", 0.0)
                elif t == "Purchase Return":
                    day_returns += ev.get("credit", 0.0)
                elif t == "Balance Adjustment":
                    day_adjustments += (ev.get("debit", 0.0) - ev.get("credit", 0.0))

            total_purchases_day = round(day_purchases + day_other, 2)
            total_returns_day = round(day_returns, 2)
            total_payments_day = round(day_payments, 2)

            if day_adjustments > 0:
                total_purchases_day = round(total_purchases_day + day_adjustments, 2)
            elif day_adjustments < 0:
                total_returns_day = round(total_returns_day + abs(day_adjustments), 2)

            prev_due = current_running_due
            closing_due = round(prev_due + total_purchases_day - total_returns_day - total_payments_day, 2)

            daily_accounts.append({
                "date": d.strftime("%Y-%m-%d"),
                "previous_due": prev_due,
                "purchase_amount": total_purchases_day,
                "return_amount": total_returns_day,
                "payment_amount": total_payments_day,
                "closing_due": closing_due,
            })

            current_running_due = closing_due

        overall_previous_due = daily_accounts[0]["previous_due"] if daily_accounts else 0.0
        overall_closing_due = daily_accounts[-1]["closing_due"] if daily_accounts else 0.0
        overall_purchases = round(sum(da["purchase_amount"] for da in daily_accounts), 2)
        overall_returns = round(sum(da["return_amount"] for da in daily_accounts), 2)
        overall_payments = round(sum(da["payment_amount"] for da in daily_accounts), 2)

        return {
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "supplier_code": supplier.supplier_code,
            "company_name": supplier.company_name,
            "phone": supplier.phone,
            "previous_due": overall_previous_due,
            "purchase_amount": overall_purchases,
            "return_amount": overall_returns,
            "payment_amount": overall_payments,
            "closing_due": overall_closing_due,
            "daily_accounts": daily_accounts,
        }


supplier_service = SupplierService()

