from datetime import date, datetime, timezone
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

        await db.delete(supplier)
        await db.commit()
        return True

    async def get_supplier_ledger(
        self,
        db: AsyncSession,
        supplier_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

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

        # Determine business timezone and centralized reconciliation baseline
        try:
            bs = await setting_service.get_business_settings(db)
            tz_str = bs.timezone or "Asia/Dhaka"
        except Exception:
            tz_str = "Asia/Dhaka"

        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc

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

        # 1. Purchases events (all historical and new purchases remain visible)
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

        # 2. Supplier Payment events (all historical and new payments remain visible)
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

        # 3. Return events (all historical and new returns remain visible)
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

        # 4. Balance Adjustment events:
        # Historical balance adjustments before baseline_start_utc are hidden from visible ledger.
        # Balance adjustments occurring on/after baseline_start_utc are visible and shown normally.
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

        # 5. Opening Balance event:
        # Opening Balance must appear at the true beginning of the ledger.
        # Its date must be chronologically valid (at or before earliest transaction).
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

        # Deterministic multi-tier sort:
        # 1. Transaction date/time ASC
        # 2. Type order (Opening Balance: 0, Purchase: 1, Payment: 2, Return: 3, Adjustment: 4)
        # 3. created_at ASC
        # 4. voucher_no ASC
        # 5. reference_id ASC
        def _event_sort_key(x):
            d = _to_utc(x["date"]) or datetime.min.replace(tzinfo=timezone.utc)
            type_order = {
                "Opening Balance": 0,
                "Purchase": 1,
                "Supplier Payment": 2,
                "Purchase Return": 3,
                "Balance Adjustment": 4,
            }.get(x["type"], 5)
            c = _to_utc(x.get("created_at")) or d
            v = x.get("voucher_no") or ""
            ref = str(x.get("reference_id") or "")
            return (d, type_order, c, v, ref)

        raw_events.sort(key=_event_sort_key)

        # Calculate reconstructed balance without hidden adjustments
        reconstructed_balance_without_hidden_adjustments = round(
            sum(ev["debit"] - ev["credit"] for ev in raw_events), 2
        )

        # Invisible reconciliation offset reconciling reconstructed balance to authoritative supplier.current_balance
        reconciliation_offset = round(
            supplier.current_balance - reconstructed_balance_without_hidden_adjustments, 2
        )

        # Compute sequential running balance incorporating reconciliation offset
        running_bal = 0.0
        calculated_events = []

        total_purchases = 0.0
        total_payments = 0.0
        total_returns = 0.0
        manual_adjustments = 0.0

        start_utc = _to_utc(start_date)
        end_utc = _to_utc(end_date)

        for ev in raw_events:
            running_bal = round(running_bal + ev["debit"] - ev["credit"], 2)
            ev_copy = dict(ev)
            ev_copy["running_balance"] = round(running_bal + reconciliation_offset, 2)

            if ev["type"] == "Purchase":
                total_purchases += ev["debit"]
            elif ev["type"] == "Supplier Payment":
                total_payments += ev["credit"]
            elif ev["type"] == "Purchase Return":
                total_returns += ev["credit"]
            elif ev["type"] == "Balance Adjustment":
                manual_adjustments += (ev["debit"] - ev["credit"])

            ev_date_utc = _to_utc(ev["date"])
            # Filter by date range if specified
            if start_utc and ev_date_utc and ev_date_utc < start_utc:
                continue
            if end_utc and ev_date_utc and ev_date_utc > end_utc:
                continue

            calculated_events.append(ev_copy)

        effective_op_balance = round(supplier.opening_balance + reconciliation_offset, 2)
        summary = {
            "opening_balance": effective_op_balance,
            "total_purchases": round(total_purchases, 2),
            "total_payments": round(total_payments, 2),
            "total_returns": round(total_returns, 2),
            "manual_adjustments": round(manual_adjustments, 2),
            "current_due": round(supplier.current_balance, 2),
        }

        return {
            "supplier": supplier,
            "summary": summary,
            "transactions": calculated_events,
        }


supplier_service = SupplierService()

