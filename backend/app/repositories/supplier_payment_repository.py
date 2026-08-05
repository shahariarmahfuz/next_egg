from datetime import datetime, time, timedelta, timezone
from typing import Dict, Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchase import Purchase
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.repositories.base import BaseRepository
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierPaymentUpdate


class SupplierPaymentRepository(BaseRepository[SupplierPayment, SupplierPaymentCreate, SupplierPaymentUpdate]):
    def __init__(self):
        super().__init__(SupplierPayment)

    async def get_by_payment_no(self, db: AsyncSession, payment_no: str) -> Optional[SupplierPayment]:
        query = select(SupplierPayment).where(SupplierPayment.payment_no == payment_no)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_payment_no(self, db: AsyncSession) -> str:
        """Generates unique supplier payment voucher number in format SP-00001."""
        query = select(func.count(SupplierPayment.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"SP-{count:05d}"
        while await self.get_by_payment_no(db, candidate):
            count += 1
            candidate = f"SP-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[SupplierPayment], int]:
        query = select(SupplierPayment).join(Supplier, SupplierPayment.supplier_id == Supplier.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    SupplierPayment.payment_no.ilike(pattern),
                    SupplierPayment.reference_no.ilike(pattern),
                    SupplierPayment.notes.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                )
            )

        if supplier_id:
            query = query.where(SupplierPayment.supplier_id == supplier_id)

        if payment_method:
            query = query.where(SupplierPayment.payment_method == payment_method)

        if start_date:
            query = query.where(SupplierPayment.payment_date >= start_date)

        if end_date:
            query = query.where(SupplierPayment.payment_date <= end_date)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Sorting
        if sort_by == "oldest":
            query = query.order_by(SupplierPayment.payment_date.asc())
        elif sort_by == "amount_desc":
            query = query.order_by(SupplierPayment.amount.desc())
        elif sort_by == "amount_asc":
            query = query.order_by(SupplierPayment.amount.asc())
        else:
            query = query.order_by(SupplierPayment.payment_date.desc())

        # Pagination & Eager loading
        query = (
            query.offset(skip)
            .limit(limit)
            .options(
                selectinload(SupplierPayment.supplier),
                selectinload(SupplierPayment.purchase),
                selectinload(SupplierPayment.user),
            )
        )

        result = await db.execute(query)
        payments = result.scalars().all()

        return payments, total

    async def get_supplier_financial_summary(self, db: AsyncSession, supplier_id: str) -> Optional[dict]:
        """Calculates total purchases, total paid, and current due for a supplier."""
        query_supp = select(Supplier).where(Supplier.id == supplier_id)
        res_supp = await db.execute(query_supp)
        supplier = res_supp.scalars().first()
        if not supplier:
            return None

        # Total Purchases
        purch_query = select(func.coalesce(func.sum(Purchase.grand_total), 0.0)).where(
            Purchase.supplier_id == supplier_id
        )
        purch_res = await db.execute(purch_query)
        total_purchases = float(purch_res.scalar() or 0.0)

        # Direct Payments
        spay_query = select(func.coalesce(func.sum(SupplierPayment.amount), 0.0)).where(
            SupplierPayment.supplier_id == supplier_id
        )
        spay_res = await db.execute(spay_query)
        total_spayments = float(spay_res.scalar() or 0.0)

        # Purchase upfront paid
        p_paid_query = select(func.coalesce(func.sum(Purchase.paid_amount), 0.0)).where(
            Purchase.supplier_id == supplier_id
        )
        p_paid_res = await db.execute(p_paid_query)
        total_purch_paid = float(p_paid_res.scalar() or 0.0)

        total_paid = round(total_purch_paid + total_spayments, 2)
        current_due = round(supplier.current_balance, 2)

        return {
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "supplier_code": supplier.supplier_code,
            "phone": supplier.phone or "",
            "total_purchases": round(total_purchases, 2),
            "total_paid": total_paid,
            "current_due": current_due,
        }

    async def get_report_data(
        self,
        db: AsyncSession,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)
        today_start = datetime.combine(now_utc.date(), time.min, tzinfo=timezone.utc)
        today_end = datetime.combine(now_utc.date(), time.max, tzinfo=timezone.utc)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(microseconds=1)
        week_start = today_start - timedelta(days=now_utc.weekday())
        month_start = today_start.replace(day=1)

        base_query = select(SupplierPayment).join(Supplier, SupplierPayment.supplier_id == Supplier.id)

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                or_(
                    SupplierPayment.payment_no.ilike(pattern),
                    SupplierPayment.reference_no.ilike(pattern),
                    SupplierPayment.notes.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                )
            )

        if supplier_id:
            base_query = base_query.where(SupplierPayment.supplier_id == supplier_id)

        if payment_method:
            base_query = base_query.where(SupplierPayment.payment_method == payment_method)

        if start_date:
            base_query = base_query.where(SupplierPayment.payment_date >= start_date)

        if end_date:
            base_query = base_query.where(SupplierPayment.payment_date <= end_date)

        # Aggregation
        sum_query = select(
            func.coalesce(func.sum(SupplierPayment.amount), 0.0),
            func.count(SupplierPayment.id),
        ).select_from(base_query.subquery())
        res = await db.execute(sum_query)
        row = res.first()
        total_paid_amount = float(row[0]) if row else 0.0
        total_payments_count = int(row[1]) if row else 0

        async def _get_sum_for_range(s_date: datetime, e_date: datetime) -> float:
            q = select(func.coalesce(func.sum(SupplierPayment.amount), 0.0)).where(
                SupplierPayment.payment_date >= s_date,
                SupplierPayment.payment_date <= e_date,
            )
            r = await db.execute(q)
            return float(r.scalar() or 0.0)

        today_amount = await _get_sum_for_range(today_start, today_end)
        yesterday_amount = await _get_sum_for_range(yesterday_start, yesterday_end)
        this_week_amount = await _get_sum_for_range(week_start, today_end)
        this_month_amount = await _get_sum_for_range(month_start, today_end)

        # Payment Method Breakdown
        pm_query = (
            select(SupplierPayment.payment_method, func.coalesce(func.sum(SupplierPayment.amount), 0.0))
            .select_from(base_query.subquery())
            .group_by(SupplierPayment.payment_method)
        )
        pm_res = await db.execute(pm_query)
        payment_method_breakdown = {r[0]: round(float(r[1]), 2) for r in pm_res.all()}

        # Daily breakdown
        date_trunc_col = func.date(SupplierPayment.payment_date)
        daily_query = (
            select(
                date_trunc_col,
                func.coalesce(func.sum(SupplierPayment.amount), 0.0),
                func.count(SupplierPayment.id),
            )
            .select_from(base_query.subquery())
            .group_by(date_trunc_col)
            .order_by(date_trunc_col.desc())
        )
        daily_res = await db.execute(daily_query)
        daily_breakdown = [
            {
                "date": str(r[0]),
                "total_amount": round(float(r[1]), 2),
                "count": int(r[2]),
            }
            for r in daily_res.all()
        ]

        return {
            "total_payments_count": total_payments_count,
            "total_paid_amount": round(total_paid_amount, 2),
            "today_amount": round(today_amount, 2),
            "yesterday_amount": round(yesterday_amount, 2),
            "this_week_amount": round(this_week_amount, 2),
            "this_month_amount": round(this_month_amount, 2),
            "payment_method_breakdown": payment_method_breakdown,
            "daily_breakdown": daily_breakdown,
        }


supplier_payment_repository = SupplierPaymentRepository()
