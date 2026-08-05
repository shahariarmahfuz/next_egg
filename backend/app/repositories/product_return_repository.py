from datetime import datetime, time, timedelta, timezone
from typing import Dict, Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier import Supplier
from app.repositories.base import BaseRepository
from app.schemas.product_return import ProductReturnCreate, ProductReturnUpdate


class ProductReturnRepository(BaseRepository[ProductReturn, ProductReturnCreate, ProductReturnUpdate]):
    def __init__(self):
        super().__init__(ProductReturn)

    async def get_by_return_no(self, db: AsyncSession, return_no: str) -> Optional[ProductReturn]:
        query = select(ProductReturn).where(ProductReturn.return_no == return_no)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_return_no(self, db: AsyncSession) -> str:
        """Generates unique product return voucher number in format PR-00001."""
        query = select(func.count(ProductReturn.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"PR-{count:05d}"
        while await self.get_by_return_no(db, candidate):
            count += 1
            candidate = f"PR-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        purchase_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[ProductReturn], int]:
        query = select(ProductReturn).join(Supplier, ProductReturn.supplier_id == Supplier.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    ProductReturn.return_no.ilike(pattern),
                    ProductReturn.reason.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                )
            )

        if supplier_id:
            query = query.where(ProductReturn.supplier_id == supplier_id)

        if purchase_id:
            query = query.where(ProductReturn.purchase_id == purchase_id)

        if start_date:
            query = query.where(ProductReturn.return_date >= start_date)

        if end_date:
            query = query.where(ProductReturn.return_date <= end_date)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Sorting
        if sort_by == "oldest":
            query = query.order_by(ProductReturn.return_date.asc())
        elif sort_by == "amount_desc":
            query = query.order_by(ProductReturn.grand_total.desc())
        elif sort_by == "amount_asc":
            query = query.order_by(ProductReturn.grand_total.asc())
        else:
            query = query.order_by(ProductReturn.return_date.desc())

        # Pagination & Eager loading
        query = (
            query.offset(skip)
            .limit(limit)
            .options(
                selectinload(ProductReturn.supplier),
                selectinload(ProductReturn.purchase),
                selectinload(ProductReturn.user),
                selectinload(ProductReturn.items).selectinload(ProductReturnItem.product),
            )
        )

        result = await db.execute(query)
        returns = result.scalars().all()

        return returns, total

    async def get_previously_returned_quantities(
        self, db: AsyncSession, purchase_id: str, exclude_return_id: Optional[str] = None
    ) -> Dict[str, float]:
        """Returns dict mapping product_id -> sum of returned quantity for a purchase."""
        query = (
            select(
                ProductReturnItem.product_id,
                func.coalesce(func.sum(ProductReturnItem.quantity), 0.0),
            )
            .join(ProductReturn, ProductReturnItem.product_return_id == ProductReturn.id)
            .where(ProductReturn.purchase_id == purchase_id)
        )

        if exclude_return_id:
            query = query.where(ProductReturn.id != exclude_return_id)

        query = query.group_by(ProductReturnItem.product_id)
        result = await db.execute(query)

        return {str(row[0]): float(row[1]) for row in result.all()}

    async def get_report_data(
        self,
        db: AsyncSession,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)
        today_start = datetime.combine(now_utc.date(), time.min, tzinfo=timezone.utc)
        today_end = datetime.combine(now_utc.date(), time.max, tzinfo=timezone.utc)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(microseconds=1)
        week_start = today_start - timedelta(days=now_utc.weekday())
        month_start = today_start.replace(day=1)

        base_query = select(ProductReturn).join(Supplier, ProductReturn.supplier_id == Supplier.id)

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                or_(
                    ProductReturn.return_no.ilike(pattern),
                    ProductReturn.reason.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                )
            )

        if supplier_id:
            base_query = base_query.where(ProductReturn.supplier_id == supplier_id)

        if start_date:
            base_query = base_query.where(ProductReturn.return_date >= start_date)

        if end_date:
            base_query = base_query.where(ProductReturn.return_date <= end_date)

        # Aggregations
        sum_query = select(
            func.coalesce(func.sum(ProductReturn.grand_total), 0.0),
            func.coalesce(func.sum(ProductReturn.refund_received), 0.0),
            func.count(ProductReturn.id),
        ).select_from(base_query.subquery())
        res = await db.execute(sum_query)
        row = res.first()
        total_returned_amount = float(row[0]) if row else 0.0
        total_refund_received = float(row[1]) if row else 0.0
        total_returns_count = int(row[2]) if row else 0

        async def _get_sum_for_range(s_date: datetime, e_date: datetime) -> float:
            q = select(func.coalesce(func.sum(ProductReturn.grand_total), 0.0)).where(
                ProductReturn.return_date >= s_date,
                ProductReturn.return_date <= e_date,
            )
            r = await db.execute(q)
            return float(r.scalar() or 0.0)

        today_amount = await _get_sum_for_range(today_start, today_end)
        yesterday_amount = await _get_sum_for_range(yesterday_start, yesterday_end)
        this_week_amount = await _get_sum_for_range(week_start, today_end)
        this_month_amount = await _get_sum_for_range(month_start, today_end)

        # Daily breakdown
        date_trunc_col = func.date(ProductReturn.return_date)
        daily_query = (
            select(
                date_trunc_col,
                func.coalesce(func.sum(ProductReturn.grand_total), 0.0),
                func.count(ProductReturn.id),
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
            "total_returns_count": total_returns_count,
            "total_returned_amount": round(total_returned_amount, 2),
            "total_refund_received": round(total_refund_received, 2),
            "today_amount": round(today_amount, 2),
            "yesterday_amount": round(yesterday_amount, 2),
            "this_week_amount": round(this_week_amount, 2),
            "this_month_amount": round(this_month_amount, 2),
            "daily_breakdown": daily_breakdown,
        }


product_return_repository = ProductReturnRepository()
