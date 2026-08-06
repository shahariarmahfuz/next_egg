from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.currency import Currency
from app.schemas.currency import CurrencyCreate, CurrencyUpdate
from app.repositories.currency_repository import currency_repository

class CurrencyService:
    async def get_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Currency]:
        return await currency_repository.get_multi(db, skip=skip, limit=limit)
        
    async def get_by_id(self, db: AsyncSession, id: str) -> Currency:
        currency = await currency_repository.get(db, id=id)
        if not currency:
            raise HTTPException(status_code=404, detail="Currency not found")
        return currency

    async def create(self, db: AsyncSession, obj_in: CurrencyCreate) -> Currency:
        existing = await currency_repository.get_by_code(db, obj_in.code)
        if existing:
            raise HTTPException(status_code=400, detail="Currency with this code already exists")
        
        currency = await currency_repository.create(db, obj_in=obj_in)
        if obj_in.is_default:
            await currency_repository.set_default_currency(db, currency.id)
        return currency
        
    async def update(self, db: AsyncSession, id: str, obj_in: CurrencyUpdate) -> Currency:
        currency = await currency_repository.get(db, id=id)
        if not currency:
            raise HTTPException(status_code=404, detail="Currency not found")
            
        if obj_in.code and obj_in.code != currency.code:
            existing = await currency_repository.get_by_code(db, obj_in.code)
            if existing:
                raise HTTPException(status_code=400, detail="Currency code already exists")

        updated = await currency_repository.update(db, db_obj=currency, obj_in=obj_in)
        if getattr(obj_in, 'is_default', False):
            await currency_repository.set_default_currency(db, currency.id)
            
        return updated
        
    async def delete(self, db: AsyncSession, id: str) -> None:
        currency = await currency_repository.get(db, id=id)
        if not currency:
            raise HTTPException(status_code=404, detail="Currency not found")
            
        if currency.is_default:
            raise HTTPException(status_code=400, detail="Cannot delete the default currency")
            
        await currency_repository.remove(db, id=id)

currency_service = CurrencyService()
