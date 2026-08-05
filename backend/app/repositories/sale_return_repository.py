from datetime import datetime, time, timedelta, timezone
from typing import Dict, Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.repositories.base import BaseRepository
from app.schemas.sale_return import SaleReturnCreate, SaleReturnUpdate


class SaleReturnRepository(BaseRepository[SaleReturn, SaleReturnCreate, SaleReturnUpdate]):
    def __init__(self):
        super().__init__(SaleReturn)

    async def get_by_return_no(self, db: AsyncSession, return_no: str) -> Optional[SaleReturn]:
        query = select(SaleReturn).where(SaleReturn.return_no == return_no)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_return_no(self, db: AsyncSession) -> str:
        """Generates unique sale return voucher number in format SR-00001."""
        query = select(func.count(SaleReturn.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"SR-{count:05d}"
        while await self.get_by_return_no(db, candidate):
            count += 1
            candidate = f"SR-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        sale_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[SaleReturn], int]:
        query = select(SaleReturn).join(Customer, SaleReturn.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    SaleReturn.return_no.ilike(pattern),
                    SaleReturn.reason.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            query = query.where(SaleReturn.customer_id == customer_id)

        if sale_id:
            query = query.where(SaleReturn.sale_id == sale_id)

        if start_date:
            query = query.where(SaleReturn.return_date >= start_date)

        if end_date:
            query = query.where(SaleReturn.return_date <= end_date)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Sorting
        if sort_by == "oldest":
            query = query.order_by(SaleReturn.return_date.asc())
        elif sort_by == "amount_desc":
            query = query.order_by(SaleReturn.grand_total.desc())
        elif sort_by == "amount_asc":
            query = query.order_by(SaleReturn.grand_total.asc())
        else:
            query = query.order_by(SaleReturn.return_date.desc())

        # Pagination & Relationships
        query = (
            query.offset(skip)
            .limit(limit)
            .options(
                selectinload(SaleReturn.customer),
                selectinload(SaleReturn.sale),
                selectinload(SaleReturn.user),
                selectinload(SaleReturn.items).selectinload(SaleReturnItem.product),
            )
        )

        result = await db.execute(query)
        returns = result.scalars().all()

        return returns, total

    async def get_previously_returned_quantities(
        self, db: AsyncSession, sale_id: str, exclude_return_id: Optional[str] = None
    ) -> Dict[str, float]:
        """Returns dict mapping product_id -> sum of returned quantity for a sale."""
        query = (
            select(
                SaleReturnItem.product_id,
                func.coalesce(func.sum(SaleReturnItem.quantity), 0.0),
            )
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .where(SaleReturn.sale_id == sale_id)
        )

        if exclude_return_id:
            query = query.where(SaleReturn.id != exclude_return_id)

        query = query.group_by(SaleReturnItem.product_id)
        result = await db.execute(query)

        return {str(row[0]): float(row[1]) for row in result.all()}

    async def get_report_data(
        self,
        db: AsyncSession,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)
        today_start = datetime.combine(now_utc.date(), time.min, tzinfo=timezone.utc)
        today_end = datetime.combine(now_utc.date(), time.max, tzinfo=timezone.utc)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(microseconds=1)
        week_start = today_start - timedelta(days=now_utc.weekday())
        month_start = today_start.replace(day=1)

        base_query = select(SaleReturn).join(Customer, SaleReturn.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                or_(
                    SaleReturn.return_no.ilike(pattern),
                    SaleReturn.reason.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            base_query = base_query.where(SaleReturn.customer_id == customer_id)

        if start_date:
            base_query = base_query.where(SaleReturn.return_date >= start_date)

        if end_date:
            base_query = base_query.where(SaleReturn.return_date <= end_date)

        # Aggregation
        sum_query = select(
            func.coalesce(func.sum(SaleReturn.grand_total), 0.0),
            func.coalesce(func.sum(SaleReturn.refund_amount), 0.0),
            func.count(SaleReturn.id),
        ).select_from(base_query.subquery())
        res = await db.execute(sum_query)
        row = res.first()
        total_returned_amount = float(row[0]) if row else 0.0
        total_refund_amount = float(row[1]) if row else 0.0
        total_returns_count = int(row[2]) if row else 0

        async def _get_sum_for_range(s_date: datetime, e_date: datetime) -> float:
            q = select(func.coalesce(func.sum(SaleReturn.grand_total), 0.0)).where(
                SaleReturn.return_date >= s_date,
                SaleReturn.return_date <= e_date,
            )
            r = await db.execute(q)
            return float(r.scalar() or 0.0)

        today_amount = await _get_sum_for_range(today_start, today_end)
        yesterday_amount = await _get_sum_for_range(yesterday_start, yesterday_end)
        this_week_amount = await _get_sum_for_range(week_start, today_end)
        this_month_amount = await _get_sum_for_range(month_start, today_end)

        # Daily breakdown
        date_trunc_col = func.date(SaleReturn.return_date)
        daily_query = (
            select(
                date_trunc_col,
                func.coalesce(func.sum(SaleReturn.grand_total), 0.0),
                func.count(SaleReturn.id),
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
            "total_refund_amount": round(total_refund_amount, 2),
            "today_amount": round(today_amount, 2),
            "yesterday_amount": round(yesterday_amount, 2),
            "this_week_amount": round(this_week_amount, 2),
            "this_month_amount": round(this_month_amount, 2),
            "daily_breakdown": daily_breakdown,
        }


sale_return_repository = SaleReturnRepository()
