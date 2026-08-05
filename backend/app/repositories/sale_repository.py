from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.repositories.base import BaseRepository
from app.schemas.sale import SaleCreate, SaleUpdate


class SaleRepository(BaseRepository[Sale, SaleCreate, SaleUpdate]):
    def __init__(self):
        super().__init__(Sale)

    async def get_by_invoice_no(self, db: AsyncSession, invoice_no: str) -> Optional[Sale]:
        query = select(Sale).where(Sale.invoice_no == invoice_no)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_invoice_no(self, db: AsyncSession) -> str:
        """Generates unique sale invoice number in format SL-00001."""
        query = select(func.count(Sale.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"SL-{count:05d}"
        while await self.get_by_invoice_no(db, candidate):
            count += 1
            candidate = f"SL-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[Sale], int]:
        query = select(Sale).join(Customer, Sale.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Sale.invoice_no.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            query = query.where(Sale.customer_id == customer_id)

        if payment_status:
            query = query.where(Sale.payment_status == payment_status)

        if start_date:
            query = query.where(Sale.sale_date >= start_date)

        if end_date:
            query = query.where(Sale.sale_date <= end_date)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Sorting logic
        if sort_by == "oldest":
            order_clause = Sale.sale_date.asc()
        elif sort_by == "highest_amount":
            order_clause = Sale.grand_total.desc()
        elif sort_by == "lowest_amount":
            order_clause = Sale.grand_total.asc()
        else:
            order_clause = Sale.sale_date.desc()

        # Paginate & Order
        query = (
            query.options(
                selectinload(Sale.customer),
                selectinload(Sale.items).selectinload(SaleItem.product),
            )
            .order_by(order_clause)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        sales = result.scalars().all()

        return sales, total

    async def get_report_summary(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        query = select(
            func.count(Sale.id).label("total_sales"),
            func.coalesce(func.sum(Sale.grand_total), 0.0).label("total_sale_amount"),
            func.coalesce(func.sum(Sale.discount_amount), 0.0).label("total_discount"),
            func.coalesce(func.sum(Sale.paid_amount), 0.0).label("total_paid"),
            func.coalesce(func.sum(Sale.due_amount), 0.0).label("total_due"),
        ).join(Customer, Sale.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Sale.invoice_no.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            query = query.where(Sale.customer_id == customer_id)
        if payment_status:
            query = query.where(Sale.payment_status == payment_status)
        if start_date:
            query = query.where(Sale.sale_date >= start_date)
        if end_date:
            query = query.where(Sale.sale_date <= end_date)

        result = await db.execute(query)
        row = result.one()

        # Compute total items sold quantity across filtered sales
        items_query = select(
            func.coalesce(func.sum(SaleItem.quantity), 0.0)
        ).join(Sale, SaleItem.sale_id == Sale.id).join(Customer, Sale.customer_id == Customer.id)

        if search:
            pattern = f"%{search}%"
            items_query = items_query.where(
                or_(
                    Sale.invoice_no.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )

        if customer_id:
            items_query = items_query.where(Sale.customer_id == customer_id)
        if payment_status:
            items_query = items_query.where(Sale.payment_status == payment_status)
        if start_date:
            items_query = items_query.where(Sale.sale_date >= start_date)
        if end_date:
            items_query = items_query.where(Sale.sale_date <= end_date)

        items_res = await db.execute(items_query)
        total_items_sold = items_res.scalar() or 0.0

        return {
            "total_sales": int(row.total_sales),
            "total_sale_amount": float(row.total_sale_amount),
            "total_discount": float(row.total_discount),
            "total_paid": float(row.total_paid),
            "total_due": float(row.total_due),
            "total_items_sold": float(total_items_sold),
        }


sale_repository = SaleRepository()
