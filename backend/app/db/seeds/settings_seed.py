import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_sessionmaker
from app.models.currency import Currency
from app.models.setting import Setting
from app.repositories.currency_repository import currency_repository
from app.repositories.setting_repository import setting_repository
from app.schemas.currency import CurrencyCreate
from app.schemas.setting import SettingCreate

async def seed_settings_and_currencies(db: AsyncSession):
    # Seed currencies
    currencies_data = [
        {"name": "US Dollar", "code": "USD", "symbol": "$", "symbol_position": "before", "decimal_places": 2, "is_default": True},
        {"name": "Bangladeshi Taka", "code": "BDT", "symbol": "৳", "symbol_position": "before", "decimal_places": 2, "is_default": False},
        {"name": "Euro", "code": "EUR", "symbol": "€", "symbol_position": "before", "decimal_places": 2, "is_default": False},
    ]

    default_currency_id = None
    for curr_data in currencies_data:
        existing = await currency_repository.get_by_code(db, curr_data["code"])
        if not existing:
            currency = await currency_repository.create(db, obj_in=CurrencyCreate(**curr_data))
            if curr_data["is_default"]:
                default_currency_id = currency.id
        else:
            if curr_data["is_default"]:
                default_currency_id = existing.id

    # Seed business settings
    if default_currency_id:
        settings_data = {
            "business_name": "Next Egg",
            "timezone": "UTC",
            "date_format": "YYYY-MM-DD",
            "time_format": "24h",
            "week_start": "Monday",
            "language": "en",
            "thousand_separator": ",",
            "decimal_separator": ".",
            "default_currency_id": str(default_currency_id)
        }

        for key, value in settings_data.items():
            existing_setting = await setting_repository.get_by_key(db, key)
            if not existing_setting:
                await setting_repository.create(db, obj_in=SettingCreate(
                    key=key, value=str(value), group_name="business"
                ))

async def main():
    async with async_session_maker() as session:
        await seed_settings_and_currencies(session)

if __name__ == "__main__":
    asyncio.run(main())
