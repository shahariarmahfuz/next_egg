from typing import Optional, Sequence
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import ConflictException, NotFoundException
from app.models.product import Product
from app.models.sale import SaleItem
from app.models.purchase import PurchaseItem
from app.models.sale_return import SaleReturnItem
from app.models.product_return import ProductReturnItem
from app.models.inventory_batch import InventoryBatch
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

        product = await product_repository.create(db, obj_in=product_data)

        if product.opening_stock > 0:
            batch = InventoryBatch(
                product_id=product.id,
                purchase_id=None,
                quantity=product.opening_stock,
                remaining_quantity=product.opening_stock,
                unit_cost=product.opening_stock_unit_cost,
            )
            db.add(batch)
            await db.flush()

        return product

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

    async def correct_stock(
        self, db: AsyncSession, product_id: str, new_stock: float
    ) -> Product:
        """
        Corrects product stock directly.
        Updates product.current_stock and adds/consumes InventoryBatches to match the new stock total.
        """
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")
            
        diff = new_stock - product.current_stock
        if diff == 0:
            return product
            
        if diff > 0:
            # Increase stock -> Create a new pseudo-batch
            batch = InventoryBatch(
                product_id=product.id,
                purchase_id=None,
                quantity=diff,
                remaining_quantity=diff,
                unit_cost=product.opening_stock_unit_cost,
            )
            db.add(batch)
        else:
            # Decrease stock -> Consume existing batches FIFO
            qty_to_deduct = abs(diff)
            batch_query = select(InventoryBatch).where(
                InventoryBatch.product_id == product.id,
                InventoryBatch.remaining_quantity > 0
            ).order_by(InventoryBatch.purchase_date.asc(), InventoryBatch.created_at.asc())
            
            batch_result = await db.execute(batch_query)
            available_batches = batch_result.scalars().all()
            for b in available_batches:
                if qty_to_deduct <= 0:
                    break
                deduct = min(b.remaining_quantity, qty_to_deduct)
                b.remaining_quantity -= deduct
                qty_to_deduct -= deduct
                db.add(b)
                
        product.current_stock = new_stock
        db.add(product)
        await db.commit()
        await db.refresh(product)
        return product

    async def delete_product(self, db: AsyncSession, product_id: str) -> bool:
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")

        await db.delete(product)
        await db.commit()
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

        await db.delete(product)
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
