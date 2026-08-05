from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import func, or_, select
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

        if payment_status:
            query = query.where(Purchase.payment_status == payment_status)

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


purchase_repository = PurchaseRepository()
