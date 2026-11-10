from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier import Supplier
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.purchase import PurchaseCreate, PurchaseUpdate


class PurchaseRepository(BaseRepository[Purchase, PurchaseCreate, PurchaseUpdate]):
    def __init__(self):
        super().__init__(Purchase)

    async def get_by_no(self, db: AsyncSession, purchase_no: str) -> Optional[Purchase]:
        query = (
            select(Purchase)
            .where(Purchase.purchase_no == purchase_no)
            .options(
                selectinload(Purchase.supplier),
                selectinload(Purchase.user),
                selectinload(Purchase.items).selectinload(PurchaseItem.product),
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_id_loaded(self, db: AsyncSession, purchase_id: str) -> Optional[Purchase]:
        query = (
            select(Purchase)
            .where(Purchase.id == purchase_id)
            .options(
                selectinload(Purchase.supplier),
                selectinload(Purchase.user),
                selectinload(Purchase.items).selectinload(PurchaseItem.product),
            )
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_purchase_no(self, db: AsyncSession) -> str:
        """Generate unique purchase order number PO-YYYY-XXXXX."""
        year = datetime.now().year
        query = select(func.count(Purchase.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1
        
        candidate = f"PO-{year}-{count:05d}"
        while await self.get_by_no(db, candidate):
            count += 1
            candidate = f"PO-{year}-{count:05d}"
        
        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        product_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[Sequence[Purchase], int]:
        query = select(Purchase)

        if search:
            pattern = f"%{search}%"
            query = query.join(Supplier, Purchase.supplier_id == Supplier.id, isouter=True).where(
                or_(
                    Purchase.purchase_no.ilike(pattern),
                    Purchase.invoice_no.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                )
            )

        if supplier_id:
            query = query.where(Purchase.supplier_id == supplier_id)

        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                query = query.where(Purchase.due_amount > 0)
            else:
                query = query.where(Purchase.payment_status == payment_status.strip())

        if product_id and product_id.strip():
            query = query.where(
                exists().where(
                    PurchaseItem.purchase_id == Purchase.id,
                    PurchaseItem.product_id == product_id.strip(),
                )
            )

        if start_date:
            query = query.where(Purchase.purchase_date >= start_date)

        if end_date:
            query = query.where(Purchase.purchase_date <= end_date)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate & Order
        query = (
            query.options(
                selectinload(Purchase.supplier),
                selectinload(Purchase.user),
                selectinload(Purchase.items).selectinload(PurchaseItem.product),
            )
            .order_by(Purchase.purchase_date.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        purchases = result.scalars().all()

        return purchases, total

    async def get_report_summary(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        product_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        # If product_id is specified, compute product-specific purchases, paid, due, and units
        if product_id and product_id.strip():
            clean_product_id = product_id.strip()

            paid_expr = case(
                (Purchase.grand_total > 0, PurchaseItem.total_price * (Purchase.paid_amount / Purchase.grand_total)),
                (Purchase.paid_amount > 0, PurchaseItem.total_price),
                else_=0.0,
            )
            due_expr = case(
                (Purchase.grand_total > 0, PurchaseItem.total_price * (Purchase.due_amount / Purchase.grand_total)),
                (Purchase.paid_amount <= 0, PurchaseItem.total_price),
                else_=0.0,
            )

            prod_query = select(
                func.count(func.distinct(Purchase.id)).label("total_purchases_count"),
                func.coalesce(func.sum(PurchaseItem.total_price), 0.0).label("total_purchase_amount"),
                func.coalesce(func.sum(PurchaseItem.discount), 0.0).label("total_discount"),
                func.coalesce(func.sum(paid_expr), 0.0).label("total_paid"),
                func.coalesce(func.sum(due_expr), 0.0).label("total_due"),
                func.coalesce(func.sum(PurchaseItem.quantity), 0.0).label("total_quantity"),
            ).join(Purchase, PurchaseItem.purchase_id == Purchase.id).where(
                PurchaseItem.product_id == clean_product_id
            )

            if search:
                pattern = f"%{search}%"
                prod_query = prod_query.join(Supplier, Purchase.supplier_id == Supplier.id, isouter=True).where(
                    or_(
                        Purchase.purchase_no.ilike(pattern),
                        Purchase.invoice_no.ilike(pattern),
                        Supplier.name.ilike(pattern),
                        Supplier.supplier_code.ilike(pattern),
                    )
                )

            if supplier_id:
                prod_query = prod_query.where(Purchase.supplier_id == supplier_id)

            if payment_status and payment_status.strip():
                clean_status = payment_status.strip().lower()
                if clean_status == "due":
                    prod_query = prod_query.where(Purchase.due_amount > 0)
                else:
                    prod_query = prod_query.where(Purchase.payment_status == payment_status.strip())

            if start_date:
                prod_query = prod_query.where(Purchase.purchase_date >= start_date)

            if end_date:
                prod_query = prod_query.where(Purchase.purchase_date <= end_date)

            result = await db.execute(prod_query)
            row = result.one()

            total_quantity = round(float(row.total_quantity or 0.0), 2)
            total_amount = round(float(row.total_purchase_amount or 0.0), 2)
            total_paid = round(float(row.total_paid or 0.0), 2)
            total_due = round(float(row.total_due or 0.0), 2)
            total_discount = round(float(row.total_discount or 0.0), 2)
            count = int(row.total_purchases_count or 0)

            return {
                "total_purchases": total_amount,
                "total_purchase_amount": total_amount,
                "total_amount": total_amount,
                "total_paid": total_paid,
                "paid_amount": total_paid,
                "total_due": total_due,
                "due_amount": total_due,
                "total_discount": total_discount,
                "total_quantity": total_quantity,
                "total_units": total_quantity,
                "total_purchases_count": count,
                "total_invoices": count,
                "count": count,
                "total_count": count,
            }

        # Otherwise (All Products)
        query = select(
            func.count(Purchase.id).label("total_purchases_count"),
            func.coalesce(func.sum(Purchase.grand_total), 0.0).label("total_purchase_amount"),
            func.coalesce(func.sum(Purchase.discount_amount), 0.0).label("total_discount"),
            func.coalesce(func.sum(Purchase.paid_amount), 0.0).label("total_paid"),
            func.coalesce(func.sum(Purchase.due_amount), 0.0).label("total_due"),
        )

        if search:
            pattern = f"%{search}%"
            query = query.join(Supplier, Purchase.supplier_id == Supplier.id, isouter=True).where(
                or_(
                    Purchase.purchase_no.ilike(pattern),
                    Purchase.invoice_no.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                )
            )

        if supplier_id:
            query = query.where(Purchase.supplier_id == supplier_id)

        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                query = query.where(Purchase.due_amount > 0)
            else:
                query = query.where(Purchase.payment_status == payment_status.strip())

        if product_id and product_id.strip():
            query = query.where(
                exists().where(
                    PurchaseItem.purchase_id == Purchase.id,
                    PurchaseItem.product_id == product_id.strip(),
                )
            )

        if start_date:
            query = query.where(Purchase.purchase_date >= start_date)

        if end_date:
            query = query.where(Purchase.purchase_date <= end_date)

        result = await db.execute(query)
        row = result.one()

        # Compute total purchase items quantity across filtered purchases
        items_query = select(
            func.coalesce(func.sum(PurchaseItem.quantity), 0.0)
        ).join(Purchase, PurchaseItem.purchase_id == Purchase.id)

        if search:
            pattern = f"%{search}%"
            items_query = items_query.join(Supplier, Purchase.supplier_id == Supplier.id, isouter=True).where(
                or_(
                    Purchase.purchase_no.ilike(pattern),
                    Purchase.invoice_no.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                )
            )

        if supplier_id:
            items_query = items_query.where(Purchase.supplier_id == supplier_id)

        if payment_status and payment_status.strip():
            clean_status = payment_status.strip().lower()
            if clean_status == "due":
                items_query = items_query.where(Purchase.due_amount > 0)
            else:
                items_query = items_query.where(Purchase.payment_status == payment_status.strip())

        if product_id and product_id.strip():
            items_query = items_query.where(PurchaseItem.product_id == product_id.strip())

        if start_date:
            items_query = items_query.where(Purchase.purchase_date >= start_date)

        if end_date:
            items_query = items_query.where(Purchase.purchase_date <= end_date)

        items_res = await db.execute(items_query)
        total_quantity = round(float(items_res.scalar() or 0.0), 2)

        total_amount = round(float(row.total_purchase_amount), 2)
        total_paid = round(float(row.total_paid), 2)
        total_due = round(float(row.total_due), 2)
        total_discount = round(float(row.total_discount), 2)
        count = int(row.total_purchases_count)

        return {
            "total_purchases": total_amount,
            "total_purchase_amount": total_amount,
            "total_amount": total_amount,
            "total_paid": total_paid,
            "paid_amount": total_paid,
            "total_due": total_due,
            "due_amount": total_due,
            "total_discount": total_discount,
            "total_quantity": total_quantity,
            "total_units": total_quantity,
            "total_purchases_count": count,
            "total_invoices": count,
            "count": count,
            "total_count": count,
        }


purchase_repository = PurchaseRepository()
