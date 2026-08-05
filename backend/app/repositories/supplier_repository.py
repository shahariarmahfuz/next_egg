from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.supplier import Supplier
from app.repositories.base import BaseRepository
from app.schemas.supplier import SupplierCreate, SupplierUpdate


class SupplierRepository(BaseRepository[Supplier, SupplierCreate, SupplierUpdate]):
    def __init__(self):
        super().__init__(Supplier)

    async def get_by_code(self, db: AsyncSession, supplier_code: str) -> Optional[Supplier]:
        query = select(Supplier).where(Supplier.supplier_code == supplier_code)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_phone(self, db: AsyncSession, phone: str) -> Optional[Supplier]:
        query = select(Supplier).where(Supplier.phone == phone)
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_supplier_code(self, db: AsyncSession) -> str:
        """Generate unique supplier code SUP-XXXXX based on count sequence."""
        query = select(func.count(Supplier.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1
        
        candidate = f"SUP-{count:05d}"
        while await self.get_by_code(db, candidate):
            count += 1
            candidate = f"SUP-{count:05d}"
        
        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        due_only: bool = False,
    ) -> tuple[Sequence[Supplier], int]:
        query = select(Supplier)

        if due_only:
            query = query.where(Supplier.current_balance > 0)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                    Supplier.company_name.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                    Supplier.email.ilike(pattern),
                )
            )

        if status:
            query = query.where(Supplier.status == status)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate & Order
        query = query.order_by(Supplier.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        suppliers = result.scalars().all()

        return suppliers, total


supplier_repository = SupplierRepository()
