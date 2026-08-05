from typing import Optional, Sequence
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import ConflictException, NotFoundException
from app.models.product import Product
from app.models.sale import SaleItem
from app.models.purchase import PurchaseItem
from app.models.sale_return import SaleReturnItem
from app.models.product_return import ProductReturnItem
from app.repositories.product_repository import product_repository
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    async def create_product(self, db: AsyncSession, product_in: ProductCreate) -> Product:
        """
        Creates a new catalog product.
        Opening stock automatically initializes the current stock.
        """
        # Product code handling
        if product_in.product_code and product_in.product_code.strip():
            existing_code = await product_repository.get_by_code(db, product_in.product_code.strip())
            if existing_code:
                raise ConflictException(f"Product code '{product_in.product_code}' already exists.")
            code = product_in.product_code.strip()
        else:
            code = await product_repository.generate_product_code(db)

        # Barcode uniqueness check if provided
        if product_in.barcode and product_in.barcode.strip():
            existing_barcode = await product_repository.get_by_barcode(db, product_in.barcode.strip())
            if existing_barcode:
                raise ConflictException(f"Product barcode '{product_in.barcode}' already exists.")

        # Create model dictionary
        product_data = product_in.model_dump()
        product_data["product_code"] = code

        # Automatic rule: Opening Stock initializes Current Stock
        product_data["current_stock"] = product_in.opening_stock

        return await product_repository.create(db, obj_in=product_data)

    async def update_product(
        self, db: AsyncSession, product_id: str, product_in: ProductUpdate
    ) -> Product:
        """
        Updates product attributes.
        Current stock and opening stock CANNOT be modified directly here.
        """
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")

        # Barcode uniqueness check if updated
        if product_in.barcode and product_in.barcode.strip() != (product.barcode or ""):
            existing_barcode = await product_repository.get_by_barcode(db, product_in.barcode.strip())
            if existing_barcode and existing_barcode.id != product_id:
                raise ConflictException(f"Product barcode '{product_in.barcode}' already exists.")

        update_data = product_in.model_dump(exclude_unset=True)
        return await product_repository.update(db, db_obj=product, obj_in=update_data)

    async def delete_product(self, db: AsyncSession, product_id: str) -> bool:
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")

        await product_repository.delete(db, id=product_id)
        return True

    async def hard_delete_product(self, db: AsyncSession, product_id: str) -> bool:
        """
        Permanently hard deletes a product and all line items referencing it across all transaction tables:
        1. SaleItem
        2. PurchaseItem
        3. SaleReturnItem
        4. ProductReturnItem
        5. Product record
        """
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")

        await db.execute(delete(SaleItem).where(SaleItem.product_id == product_id))
        await db.execute(delete(PurchaseItem).where(PurchaseItem.product_id == product_id))
        await db.execute(delete(SaleReturnItem).where(SaleReturnItem.product_id == product_id))
        await db.execute(delete(ProductReturnItem).where(ProductReturnItem.product_id == product_id))

        await product_repository.delete(db, id=product_id)
        await db.commit()
        return True

    async def get_product(self, db: AsyncSession, product_id: str) -> Product:
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")
        return product

    async def get_products_paginated(
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
        return await product_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, category=category, brand=brand, status=status
        )

    async def get_categories(self, db: AsyncSession) -> list[str]:
        return await product_repository.get_distinct_categories(db)


product_service = ProductService()
