from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
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
        product_id: Optional[str] = None,
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

        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                query = query.where(Sale.due_amount > 0)
            else:
                query = query.where(Sale.payment_status == payment_status.strip())

        if product_id and product_id.strip():
            query = query.where(
                exists().where(
                    SaleItem.sale_id == Sale.id,
                    SaleItem.product_id == product_id.strip(),
                )
            )

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
            order_clause = (Sale.sale_date.asc(), Sale.created_at.asc())
        elif sort_by == "highest_amount":
            order_clause = (Sale.grand_total.desc(), Sale.created_at.desc())
        elif sort_by == "lowest_amount":
            order_clause = (Sale.grand_total.asc(), Sale.created_at.desc())
        else:
            order_clause = (Sale.sale_date.desc(), Sale.created_at.desc())

        # Paginate & Order
        query = (
            query.options(
                selectinload(Sale.customer),
                selectinload(Sale.items).selectinload(SaleItem.product),
            )
            .order_by(*order_clause)
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
        product_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        # If product_id is specified, compute product-specific sales, paid, due, and units
        if product_id and product_id.strip():
            clean_product_id = product_id.strip()

            # Proportional allocation for payment & due when multiple items exist on a sale:
            # If sale.grand_total > 0: line_share = sale_item.total_price * (sale.paid_amount / sale.grand_total)
            paid_expr = case(
                (Sale.grand_total > 0, SaleItem.total_price * (Sale.paid_amount / Sale.grand_total)),
                (Sale.paid_amount > 0, SaleItem.total_price),
                else_=0.0,
            )
            due_expr = case(
                (Sale.grand_total > 0, SaleItem.total_price * (Sale.due_amount / Sale.grand_total)),
                (Sale.paid_amount <= 0, SaleItem.total_price),
                else_=0.0,
            )

            prod_query = select(
                func.count(func.distinct(Sale.id)).label("total_sales"),
                func.coalesce(func.sum(SaleItem.total_price), 0.0).label("total_sale_amount"),
                func.coalesce(func.sum(SaleItem.discount), 0.0).label("total_discount"),
                func.coalesce(func.sum(paid_expr), 0.0).label("total_paid"),
                func.coalesce(func.sum(due_expr), 0.0).label("total_due"),
                func.coalesce(func.sum(SaleItem.quantity), 0.0).label("total_items_sold"),
            ).join(Sale, SaleItem.sale_id == Sale.id).join(Customer, Sale.customer_id == Customer.id).where(
                SaleItem.product_id == clean_product_id
            )

            if search:
                pattern = f"%{search}%"
                prod_query = prod_query.where(
                    or_(
                        Sale.invoice_no.ilike(pattern),
                        Customer.name.ilike(pattern),
                        Customer.customer_code.ilike(pattern),
                        Customer.phone.ilike(pattern),
                    )
                )

            if customer_id:
                prod_query = prod_query.where(Sale.customer_id == customer_id)
            if payment_status and payment_status.strip():
                clean_status = payment_status.strip().lower()
                if clean_status == "due":
                    prod_query = prod_query.where(Sale.due_amount > 0)
                else:
                    prod_query = prod_query.where(Sale.payment_status == payment_status.strip())
            if start_date:
                prod_query = prod_query.where(Sale.sale_date >= start_date)
            if end_date:
                prod_query = prod_query.where(Sale.sale_date <= end_date)

            result = await db.execute(prod_query)
            row = result.one()

            total_sales = int(row.total_sales or 0)
            total_sale_amount = round(float(row.total_sale_amount or 0.0), 2)
            total_discount = round(float(row.total_discount or 0.0), 2)
            total_paid = round(float(row.total_paid or 0.0), 2)
            total_due = round(float(row.total_due or 0.0), 2)
            total_items_sold = round(float(row.total_items_sold or 0.0), 4)

            ret_refund_expr = case(
                (SaleReturn.grand_total > 0, SaleReturnItem.total_price * (SaleReturn.refund_amount / SaleReturn.grand_total)),
                else_=0.0,
            )
            ret_prod_query = (
                select(
                    func.coalesce(func.sum(SaleReturnItem.total_price), 0.0).label("total_return_amount"),
                    func.coalesce(func.sum(ret_refund_expr), 0.0).label("total_refund_amount"),
                    func.coalesce(func.sum(SaleReturnItem.quantity), 0.0).label("total_return_units"),
                )
                .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
                .join(Customer, SaleReturn.customer_id == Customer.id)
                .outerjoin(Sale, SaleReturn.sale_id == Sale.id)
                .where(SaleReturnItem.product_id == clean_product_id)
            )
            ret_prod_query = self._apply_sale_return_filters(
                ret_prod_query,
                search=search,
                customer_id=customer_id,
                payment_status=payment_status,
                start_date=start_date,
                end_date=end_date,
            )
            ret_row = (await db.execute(ret_prod_query)).one()
            total_return_amount = round(float(ret_row.total_return_amount or 0.0), 2)
            total_refund_amount = round(float(ret_row.total_refund_amount or 0.0), 2)
            total_return_units = round(float(ret_row.total_return_units or 0.0), 4)

            return {
                "total_sales": total_sales,
                "total_invoices": total_sales,
                "total_sales_count": total_sales,
                "total_count": total_sales,
                "count": total_sales,
                "total_sale_amount": total_sale_amount,
                "total_amount": total_sale_amount,
                "total_revenue": total_sale_amount,
                "total_discount": total_discount,
                "total_paid": total_paid,
                "paid_amount": total_paid,
                "total_due": total_due,
                "due_amount": total_due,
                "total_items_sold": total_items_sold,
                "total_units": total_items_sold,
                "total_return_amount": total_return_amount,
                "total_refund_amount": total_refund_amount,
                "total_return_units": total_return_units,
                "net_sale_amount": round(total_sale_amount - total_return_amount, 2),
                "net_units_sold": round(total_items_sold - total_return_units, 4),
            }

        # Otherwise (All Products), compute invoice-level totals
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
        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                query = query.where(Sale.due_amount > 0)
            else:
                query = query.where(Sale.payment_status == payment_status.strip())
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
        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                items_query = items_query.where(Sale.due_amount > 0)
            else:
                items_query = items_query.where(Sale.payment_status == payment_status.strip())
        if start_date:
            items_query = items_query.where(Sale.sale_date >= start_date)
        if end_date:
            items_query = items_query.where(Sale.sale_date <= end_date)

        items_res = await db.execute(items_query)
        total_items_sold = items_res.scalar() or 0.0

        ret_header_query = (
            select(
                func.coalesce(func.sum(SaleReturn.grand_total), 0.0).label("total_return_amount"),
                func.coalesce(func.sum(SaleReturn.refund_amount), 0.0).label("total_refund_amount"),
            )
            .join(Customer, SaleReturn.customer_id == Customer.id)
            .outerjoin(Sale, SaleReturn.sale_id == Sale.id)
        )
        ret_header_query = self._apply_sale_return_filters(
            ret_header_query,
            search=search,
            customer_id=customer_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
        )
        ret_header_row = (await db.execute(ret_header_query)).one()
        total_return_amount = round(float(ret_header_row.total_return_amount or 0.0), 2)
        total_refund_amount = round(float(ret_header_row.total_refund_amount or 0.0), 2)

        ret_items_query = (
            select(func.coalesce(func.sum(SaleReturnItem.quantity), 0.0))
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .join(Customer, SaleReturn.customer_id == Customer.id)
            .outerjoin(Sale, SaleReturn.sale_id == Sale.id)
        )
        ret_items_query = self._apply_sale_return_filters(
            ret_items_query,
            search=search,
            customer_id=customer_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
        )
        total_return_units = round(float((await db.execute(ret_items_query)).scalar() or 0.0), 4)

        total_sale_amount_val = float(row.total_sale_amount)
        total_items_sold_val = float(total_items_sold)

        return {
            "total_sales": int(row.total_sales),
            "total_invoices": int(row.total_sales),
            "total_sales_count": int(row.total_sales),
            "total_count": int(row.total_sales),
            "count": int(row.total_sales),
            "total_sale_amount": total_sale_amount_val,
            "total_amount": total_sale_amount_val,
            "total_revenue": total_sale_amount_val,
            "total_discount": float(row.total_discount),
            "total_paid": float(row.total_paid),
            "paid_amount": float(row.total_paid),
            "total_due": float(row.total_due),
            "due_amount": float(row.total_due),
            "total_items_sold": total_items_sold_val,
            "total_units": total_items_sold_val,
            "total_return_amount": total_return_amount,
            "total_refund_amount": total_refund_amount,
            "total_return_units": total_return_units,
            "net_sale_amount": round(total_sale_amount_val - total_return_amount, 2),
            "net_units_sold": round(total_items_sold_val - total_return_units, 4),
        }

    def _apply_sale_return_filters(
        self,
        query,
        *,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ):
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    SaleReturn.return_no.ilike(pattern),
                    Sale.invoice_no.ilike(pattern),
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                )
            )
        if customer_id:
            query = query.where(SaleReturn.customer_id == customer_id)
        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                query = query.where(Sale.due_amount > 0)
            else:
                query = query.where(Sale.payment_status == payment_status.strip())
        if start_date:
            query = query.where(SaleReturn.return_date >= start_date)
        if end_date:
            query = query.where(SaleReturn.return_date <= end_date)
        return query



sale_repository = SaleRepository()
