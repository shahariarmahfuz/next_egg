from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.currency import Currency
from app.repositories.base import BaseRepository
from app.schemas.currency import CurrencyCreate, CurrencyUpdate

class CurrencyRepository(BaseRepository[Currency, CurrencyCreate, CurrencyUpdate]):
    async def get_by_code(self, db: AsyncSession, code: str) -> Currency | None:
        query = select(Currency).where(Currency.code == code)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_default_currency(self, db: AsyncSession) -> Currency | None:
        query = select(Currency).where(Currency.is_default == True)
        result = await db.execute(query)
        return result.scalars().first()

    async def set_default_currency(self, db: AsyncSession, currency_id: str) -> None:
        # First unset all defaults
        await db.execute(update(Currency).values(is_default=False))
        # Set the new default
        await db.execute(update(Currency).where(Currency.id == currency_id).values(is_default=True))
        await db.commit()

currency_repository = CurrencyRepository(Currency)
