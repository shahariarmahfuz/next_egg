from datetime import date
from typing import Optional, Sequence, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.farm_transaction import FarmTransaction, FarmTransactionType
from app.repositories.farm_repository import farm_repository
from app.repositories.product_repository import product_repository
from app.schemas.farm import (
    FarmProductionCreate,
    FarmDeliveryCreate,
    FarmWasteCreate,
    FarmTransactionResponse,
)


class FarmService:
    def format_transaction(self, txn: FarmTransaction) -> FarmTransactionResponse:
        p_name = txn.product.name if txn.product else None
        p_code = txn.product.product_code if txn.product else None
        p_unit = txn.product.unit if txn.product else None

        return FarmTransactionResponse(
            id=txn.id,
            product_id=txn.product_id,
            transaction_type=txn.transaction_type,
            transaction_date=txn.transaction_date,
            tray_count=txn.tray_count,
            units_per_tray=txn.units_per_tray,
            quantity=txn.quantity,
            destination=txn.destination,
            notes=txn.notes,
            created_at=txn.created_at,
            product_name=p_name,
            product_code=p_code,
            unit=p_unit,
        )

    async def _update_product_stock(self, db: AsyncSession, product_id: str, quantity_change: float):
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException("Farm Product not found")
        if product.product_type != "FARM":
            raise BadRequestException(f"Product '{product.name}' is not a FARM product.")
        
        new_stock = round(float(product.current_stock) + quantity_change, 4)
        if new_stock < 0:
            raise BadRequestException(
                f"Insufficient farm stock for '{product.name}'. Available: {product.current_stock} {product.unit}, Requested change: {abs(quantity_change)} {product.unit}."
            )
            
        await product_repository.update(db, db_obj=product, obj_in={"current_stock": new_stock})
        return product

    async def create_production(self, db: AsyncSession, obj_in: FarmProductionCreate) -> FarmTransactionResponse:
        await self._update_product_stock(db, obj_in.product_id, obj_in.quantity)
        txn = FarmTransaction(
            product_id=obj_in.product_id,
            transaction_type=FarmTransactionType.PRODUCTION,
            transaction_date=obj_in.transaction_date,
            tray_count=obj_in.tray_count,
            units_per_tray=obj_in.units_per_tray,
            quantity=obj_in.quantity,
            notes=(obj_in.notes or obj_in.note or "").strip() or None,
        )
        created = await farm_repository.create_transaction(db, txn)
        return self.format_transaction(created)

    async def create_delivery(self, db: AsyncSession, obj_in: FarmDeliveryCreate) -> FarmTransactionResponse:
        await self._update_product_stock(db, obj_in.product_id, -obj_in.quantity)
        txn = FarmTransaction(
            product_id=obj_in.product_id,
            transaction_type=FarmTransactionType.DELIVERY,
            transaction_date=obj_in.transaction_date,
            tray_count=obj_in.tray_count,
            units_per_tray=obj_in.units_per_tray,
            quantity=obj_in.quantity,
            destination=obj_in.destination,
            notes=(obj_in.notes or obj_in.note or "").strip() or None,
        )
        created = await farm_repository.create_transaction(db, txn)
        return self.format_transaction(created)

    async def create_waste(self, db: AsyncSession, obj_in: FarmWasteCreate) -> FarmTransactionResponse:
        await self._update_product_stock(db, obj_in.product_id, -obj_in.quantity)
        note_text = (obj_in.notes or obj_in.note or "").strip()
        waste_notes = None
        if obj_in.reason and note_text:
            waste_notes = f"[{obj_in.reason}] {note_text}"
        elif obj_in.reason:
            waste_notes = f"[{obj_in.reason}]"
        elif note_text:
            waste_notes = note_text

        txn = FarmTransaction(
            product_id=obj_in.product_id,
            transaction_type=FarmTransactionType.WASTE,
            transaction_date=obj_in.transaction_date,
            quantity=obj_in.quantity,
            notes=waste_notes,
        )
        created = await farm_repository.create_transaction(db, txn)
        return self.format_transaction(created)

    async def get_transactions(
        self,
        db: AsyncSession,
        *,
        transaction_type: Optional[FarmTransactionType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        product_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[list[FarmTransactionResponse], int]:
        items, total = await farm_repository.get_transactions(
            db,
            transaction_type=transaction_type,
            start_date=start_date,
            end_date=end_date,
            product_id=product_id,
            skip=skip,
            limit=limit,
        )
        formatted = [self.format_transaction(i) for i in items]
        return formatted, total

    async def get_dashboard_kpis(self, db: AsyncSession, today: date):
        return await farm_repository.get_dashboard_kpis(db, today=today)

    async def get_stock_overview(self, db: AsyncSession):
        return await farm_repository.get_farm_stock_overview(db)

    async def get_farm_report(self, db: AsyncSession, start_date: date, end_date: date):
        return await farm_repository.get_farm_report(db, start_date=start_date, end_date=end_date)


farm_service = FarmService()

