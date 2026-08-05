from datetime import datetime, time, timedelta, timezone
from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.customer_collection import CustomerCollection
from app.models.sale import Sale
from app.repositories.base import BaseRepository
from app.schemas.customer_collection import CustomerCollectionCreate, CustomerCollectionUpdate


class CustomerCollectionRepository(
    BaseRepository[CustomerCollection, CustomerCollectionCreate, CustomerCollectionUpdate]
):
    def __init__(self):
        super().__init__(CustomerCollection)

    async def get_by_collection_no(
        self, db: AsyncSession, collection_no: str
    ) -> Optional[CustomerCollection]:
        query = select(CustomerCollection).where(CustomerCollection.collection_no == collection_no)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_collection_no(self, db: AsyncSession) -> str:
        """Generates unique collection voucher number in format COL-00001."""
        query = select(func.count(CustomerCollection.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"COL-{count:05d}"
        while await self.get_by_collection_no(db, candidate):
            count += 1
            candidate = f"COL-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[CustomerCollection], int]:
        query = select(CustomerCollection).join(Customer, CustomerCollection.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    CustomerCollection.collection_no.ilike(pattern),
                    CustomerCollection.reference_no.ilike(pattern),
                    CustomerCollection.notes.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            query = query.where(CustomerCollection.customer_id == customer_id)

        if payment_method:
            query = query.where(CustomerCollection.payment_method == payment_method)

        if start_date:
            query = query.where(CustomerCollection.collection_date >= start_date)

        if end_date:
            query = query.where(CustomerCollection.collection_date <= end_date)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Sorting
        if sort_by == "oldest":
            query = query.order_by(CustomerCollection.collection_date.asc())
        elif sort_by == "amount_desc":
            query = query.order_by(CustomerCollection.amount.desc())
        elif sort_by == "amount_asc":
            query = query.order_by(CustomerCollection.amount.asc())
        else:
            query = query.order_by(CustomerCollection.collection_date.desc())

        # Pagination & Eager Loading
        query = (
            query.offset(skip)
            .limit(limit)
            .options(
                selectinload(CustomerCollection.customer),
                selectinload(CustomerCollection.user),
                selectinload(CustomerCollection.sale),
            )
        )

        result = await db.execute(query)
        collections = result.scalars().all()

        return collections, total

    async def get_customer_financial_summary(
        self, db: AsyncSession, customer_id: str
    ) -> Optional[dict]:
        """
        Calculates financial stats for a given customer:
        - Current Due (customer.current_balance)
        - Total Sales (sum of Sale.grand_total)
        - Total Paid (sum of Sale.paid_amount + sum of CustomerCollection.amount)
        - Remaining Due (customer.current_balance)
        """
        # Fetch customer
        cust_query = select(Customer).where(Customer.id == customer_id)
        cust_res = await db.execute(cust_query)
        customer = cust_res.scalars().first()
        if not customer:
            return None

        # Total Sales sum
        sales_query = select(
            func.coalesce(func.sum(Sale.grand_total), 0.0),
            func.coalesce(func.sum(Sale.paid_amount), 0.0),
        ).where(Sale.customer_id == customer_id)
        sales_res = await db.execute(sales_query)
        row = sales_res.first()
        total_sales_grand = float(row[0]) if row else 0.0
        total_sales_paid = float(row[1]) if row else 0.0

        # Total Collections sum
        col_query = select(func.coalesce(func.sum(CustomerCollection.amount), 0.0)).where(
            CustomerCollection.customer_id == customer_id
        )
        col_res = await db.execute(col_query)
        total_collections = float(col_res.scalar() or 0.0)

        total_sales = round(total_sales_grand, 2)
        total_paid = round(total_sales_paid + total_collections, 2)
        current_due = round(customer.current_balance, 2)
        remaining_due = current_due

        return {
            "customer_id": customer.id,
            "customer_code": customer.customer_code,
            "name": customer.name,
            "phone": customer.phone,
            "current_due": current_due,
            "total_sales": total_sales,
            "total_paid": total_paid,
            "remaining_due": remaining_due,
        }

    async def get_report_data(
        self,
        db: AsyncSession,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)
        today_start = datetime.combine(now_utc.date(), time.min, tzinfo=timezone.utc)
        today_end = datetime.combine(now_utc.date(), time.max, tzinfo=timezone.utc)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(microseconds=1)
        week_start = today_start - timedelta(days=now_utc.weekday())
        month_start = today_start.replace(day=1)

        # Base filtered query
        base_query = select(CustomerCollection).join(
            Customer, CustomerCollection.customer_id == Customer.id
        )
        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                or_(
                    CustomerCollection.collection_no.ilike(pattern),
                    CustomerCollection.reference_no.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )
        if customer_id:
            base_query = base_query.where(CustomerCollection.customer_id == customer_id)
        if payment_method:
            base_query = base_query.where(CustomerCollection.payment_method == payment_method)
        if start_date:
            base_query = base_query.where(CustomerCollection.collection_date >= start_date)
        if end_date:
            base_query = base_query.where(CustomerCollection.collection_date <= end_date)

        # Total amount & count
        sum_cnt_query = select(
            func.coalesce(func.sum(CustomerCollection.amount), 0.0),
            func.count(CustomerCollection.id),
        ).select_from(base_query.subquery())
        res = await db.execute(sum_cnt_query)
        sum_row = res.first()
        total_collected_amount = float(sum_row[0]) if sum_row else 0.0
        total_collections_count = int(sum_row[1]) if sum_row else 0

        # Time ranges
        async def _get_sum_for_range(s_date: datetime, e_date: datetime) -> float:
            q = select(func.coalesce(func.sum(CustomerCollection.amount), 0.0)).where(
                CustomerCollection.collection_date >= s_date,
                CustomerCollection.collection_date <= e_date,
            )
            r = await db.execute(q)
            return float(r.scalar() or 0.0)

        today_amount = await _get_sum_for_range(today_start, today_end)
        yesterday_amount = await _get_sum_for_range(yesterday_start, yesterday_end)
        this_week_amount = await _get_sum_for_range(week_start, today_end)
        this_month_amount = await _get_sum_for_range(month_start, today_end)

        # Payment method breakdown
        pm_query = (
            select(
                CustomerCollection.payment_method,
                func.coalesce(func.sum(CustomerCollection.amount), 0.0),
                func.count(CustomerCollection.id),
            )
            .select_from(base_query.subquery())
            .group_by(CustomerCollection.payment_method)
        )
        pm_res = await db.execute(pm_query)
        pm_breakdown = [
            {
                "payment_method": row[0],
                "total_amount": round(float(row[1]), 2),
                "count": int(row[2]),
            }
            for row in pm_res.all()
        ]

        # Daily breakdown
        date_trunc_col = func.date(CustomerCollection.collection_date)
        daily_query = (
            select(
                date_trunc_col,
                func.coalesce(func.sum(CustomerCollection.amount), 0.0),
                func.count(CustomerCollection.id),
            )
            .select_from(base_query.subquery())
            .group_by(date_trunc_col)
            .order_by(date_trunc_col.desc())
        )
        daily_res = await db.execute(daily_query)
        daily_breakdown = [
            {
                "date": str(row[0]),
                "total_amount": round(float(row[1]), 2),
                "count": int(row[2]),
            }
            for row in daily_res.all()
        ]

        return {
            "total_collections_count": total_collections_count,
            "total_collected_amount": round(total_collected_amount, 2),
            "today_amount": round(today_amount, 2),
            "yesterday_amount": round(yesterday_amount, 2),
            "this_week_amount": round(this_week_amount, 2),
            "this_month_amount": round(this_month_amount, 2),
            "payment_method_breakdown": pm_breakdown,
            "daily_breakdown": daily_breakdown,
        }


customer_collection_repository = CustomerCollectionRepository()
