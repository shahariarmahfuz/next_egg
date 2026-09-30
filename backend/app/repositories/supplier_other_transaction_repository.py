from datetime import datetime
from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.supplier import Supplier
from app.models.supplier_other_transaction import SupplierOtherTransaction
from app.repositories.base import BaseRepository
from app.schemas.supplier_other_transaction import (
    SupplierOtherTransactionCreate,
    SupplierOtherTransactionUpdate,
)


class SupplierOtherTransactionRepository(
    BaseRepository[SupplierOtherTransaction, SupplierOtherTransactionCreate, SupplierOtherTransactionUpdate]
):
    def __init__(self):
        super().__init__(SupplierOtherTransaction)

    async def get_by_voucher_no(
        self, db: AsyncSession, voucher_no: str
    ) -> Optional[SupplierOtherTransaction]:
        query = (
            select(SupplierOtherTransaction)
            .options(
                selectinload(SupplierOtherTransaction.supplier),
                selectinload(SupplierOtherTransaction.user),
            )
            .where(SupplierOtherTransaction.voucher_no == voucher_no)
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def generate_voucher_no(self, db: AsyncSession) -> str:
        """Generates unique voucher number in format SOT-00001."""
        query = select(func.count(SupplierOtherTransaction.id))
        result = await db.execute(query)
        count = (result.scalar() or 0) + 1

        candidate = f"SOT-{count:05d}"
        while await self.get_by_voucher_no(db, candidate):
            count += 1
            candidate = f"SOT-{count:05d}"

        return candidate

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[Sequence[SupplierOtherTransaction], int]:
        query = (
            select(SupplierOtherTransaction)
            .join(Supplier, SupplierOtherTransaction.supplier_id == Supplier.id)
            .options(
                selectinload(SupplierOtherTransaction.supplier),
                selectinload(SupplierOtherTransaction.user),
            )
        )

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    SupplierOtherTransaction.voucher_no.ilike(pattern),
                    SupplierOtherTransaction.reference_no.ilike(pattern),
                    SupplierOtherTransaction.notes.ilike(pattern),
                    Supplier.name.ilike(pattern),
                    Supplier.supplier_code.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                )
            )

        if supplier_id:
            query = query.where(SupplierOtherTransaction.supplier_id == supplier_id)

        if transaction_type:
            query = query.where(SupplierOtherTransaction.transaction_type == transaction_type)

        if start_date:
            query = query.where(SupplierOtherTransaction.transaction_date >= start_date)

        if end_date:
            query = query.where(SupplierOtherTransaction.transaction_date <= end_date)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Order and pagination
        query = query.order_by(SupplierOtherTransaction.transaction_date.desc(), SupplierOtherTransaction.created_at.desc())
        query = query.offset(skip).limit(limit)

        results = await db.execute(query)
        items = results.scalars().all()

        return items, total


supplier_other_transaction_repository = SupplierOtherTransactionRepository()
