from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.repositories.base import BaseRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerRepository(BaseRepository[Customer, CustomerCreate, CustomerUpdate]):
    def __init__(self):
        super().__init__(Customer)

    async def get_by_code(self, db: AsyncSession, customer_code: str) -> Optional[Customer]:
        query = select(Customer).where(Customer.customer_code == customer_code)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_phone(self, db: AsyncSession, phone: str) -> Optional[Customer]:
        if not phone or not phone.strip():
            return None
        query = select(Customer).where(Customer.phone == phone.strip())
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_customer_code(self, db: AsyncSession) -> str:
        """Generates unique customer code in format CUST-00001."""
        query = select(func.count(Customer.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"CUST-{count:05d}"
        while await self.get_by_code(db, candidate):
            count += 1
            candidate = f"CUST-{count:05d}"

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
    ) -> tuple[Sequence[Customer], int]:
        query = select(Customer)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Customer.name.ilike(pattern),
                    Customer.customer_code.ilike(pattern),
                    Customer.phone.ilike(pattern),
                    Customer.email.ilike(pattern),
                )
            )

        if status:
            query = query.where(Customer.status == status)

        if due_only:
            query = query.where(Customer.current_balance > 0)

        # Count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate & Order
        query = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        customers = result.scalars().all()

        return customers, total


customer_repository = CustomerRepository()
