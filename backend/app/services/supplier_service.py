from typing import Optional, Sequence
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier_payment import SupplierPayment
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.balance_adjustment import BalanceAdjustment
from app.repositories.supplier_repository import supplier_repository
from app.schemas.supplier import SupplierCreate, SupplierUpdate


class SupplierService:
    async def create_supplier(self, db: AsyncSession, supplier_in: SupplierCreate) -> Supplier:
        # Supplier code handling
        if supplier_in.supplier_code and supplier_in.supplier_code.strip():
            existing_code = await supplier_repository.get_by_code(db, supplier_in.supplier_code.strip())
            if existing_code:
                raise ConflictException(f"Supplier code '{supplier_in.supplier_code}' is already in use.")
            code = supplier_in.supplier_code.strip()
        else:
            code = await supplier_repository.generate_supplier_code(db)

        supplier_data = supplier_in.model_dump()
        supplier_data["supplier_code"] = code
        if supplier_in.phone and supplier_in.phone.strip():
            supplier_data["phone"] = supplier_in.phone.strip()
        else:
            supplier_data["phone"] = None

        # Opening Due automatically initializes current_balance
        supplier_data["current_balance"] = supplier_in.opening_balance or 0.0

        return await supplier_repository.create(db, obj_in=supplier_data)

    async def update_supplier(self, db: AsyncSession, supplier_id: str, supplier_in: SupplierUpdate) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        update_data = supplier_in.model_dump(exclude_unset=True)
        if "phone" in update_data and update_data["phone"]:
            update_data["phone"] = update_data["phone"].strip()

        return await supplier_repository.update(db, db_obj=supplier, obj_in=update_data)

    async def update_supplier_status(self, db: AsyncSession, supplier_id: str, new_status: str) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        if new_status not in ["active", "inactive"]:
            raise BadRequestException("Invalid supplier status. Allowed values: active, inactive")

        return await supplier_repository.update(db, db_obj=supplier, obj_in={"status": new_status})

    async def get_supplier(self, db: AsyncSession, supplier_id: str) -> Supplier:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")
        return supplier

    async def get_suppliers_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        due_only: bool = False,
    ) -> tuple[Sequence[Supplier], int]:
        return await supplier_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, status=status, due_only=due_only
        )

    async def delete_supplier(self, db: AsyncSession, supplier_id: str) -> bool:
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        return await supplier_repository.delete(db, id=supplier_id)

    async def hard_delete_supplier(self, db: AsyncSession, supplier_id: str) -> bool:
        """
        Permanently hard deletes a supplier and all dependent records in correct cascade order:
        1. ProductReturnItems & ProductReturns
        2. PurchaseItems & Purchases
        3. SupplierPayments
        4. BalanceAdjustments
        5. Supplier record
        """
        supplier = await supplier_repository.get_by_id(db, id=supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        # 1. Delete ProductReturnItems and ProductReturns
        returns_q = select(ProductReturn.id).where(ProductReturn.supplier_id == supplier_id)
        returns_res = await db.execute(returns_q)
        return_ids = returns_res.scalars().all()
        if return_ids:
            await db.execute(delete(ProductReturnItem).where(ProductReturnItem.product_return_id.in_(return_ids)))
            await db.execute(delete(ProductReturn).where(ProductReturn.id.in_(return_ids)))

        # 2. Delete PurchaseItems and Purchases
        purchases_q = select(Purchase.id).where(Purchase.supplier_id == supplier_id)
        purchases_res = await db.execute(purchases_q)
        purchase_ids = purchases_res.scalars().all()
        if purchase_ids:
            await db.execute(delete(PurchaseItem).where(PurchaseItem.purchase_id.in_(purchase_ids)))
            await db.execute(delete(Purchase).where(Purchase.id.in_(purchase_ids)))

        # 3. Delete SupplierPayments
        await db.execute(delete(SupplierPayment).where(SupplierPayment.supplier_id == supplier_id))

        # 4. Delete BalanceAdjustments
        await db.execute(delete(BalanceAdjustment).where(BalanceAdjustment.supplier_id == supplier_id))

        # 5. Delete Supplier
        await supplier_repository.delete(db, id=supplier_id)
        await db.commit()
        return True


supplier_service = SupplierService()
