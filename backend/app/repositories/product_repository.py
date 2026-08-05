from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.repositories.base import BaseRepository
from app.schemas.product import ProductCreate, ProductUpdate


class ProductRepository(BaseRepository[Product, ProductCreate, ProductUpdate]):
    def __init__(self):
        super().__init__(Product)

    async def get_by_code(self, db: AsyncSession, product_code: str) -> Optional[Product]:
        query = select(Product).where(Product.product_code == product_code)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_barcode(self, db: AsyncSession, barcode: str) -> Optional[Product]:
        if not barcode or not barcode.strip():
            return None
        query = select(Product).where(Product.barcode == barcode.strip())
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_product_code(self, db: AsyncSession) -> str:
        """Generates unique product code in format PRD-00001."""
        query = select(func.count(Product.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"PRD-{count:05d}"
        while await self.get_by_code(db, candidate):
            count += 1
            candidate = f"PRD-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[Sequence[Product], int]:
        query = select(Product)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Product.name.ilike(pattern),
                    Product.product_code.ilike(pattern),
                    Product.barcode.ilike(pattern),
                    Product.category.ilike(pattern),
                    Product.brand.ilike(pattern),
                )
            )

        if category:
            query = query.where(Product.category == category)

        if brand:
            query = query.where(Product.brand == brand)

        if status:
            query = query.where(Product.status == status)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate & Order
        query = query.order_by(Product.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        products = result.scalars().all()

        return products, total

    async def get_distinct_categories(self, db: AsyncSession) -> list[str]:
        query = (
            select(Product.category)
            .where(Product.category.isnot(None), Product.category != "")
            .distinct()
            .order_by(Product.category.asc())
        )
        result = await db.execute(query)
        return [c for c in result.scalars().all() if c]


product_repository = ProductRepository()
