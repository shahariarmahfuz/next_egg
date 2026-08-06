from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.setting_repository import setting_repository
from app.repositories.currency_repository import currency_repository
from app.schemas.setting import BusinessSettingsResponse, BusinessSettingsUpdate, SettingCreate
from app.schemas.currency import CurrencyResponse

class SettingService:
    async def get_business_settings(self, db: AsyncSession) -> BusinessSettingsResponse:
        settings = await setting_repository.get_by_group(db, "business")
        settings_dict = {setting.key: setting.value for setting in settings}
        
        response = BusinessSettingsResponse(
            business_name=settings_dict.get("business_name"),
            timezone=settings_dict.get("timezone"),
            date_format=settings_dict.get("date_format"),
            time_format=settings_dict.get("time_format"),
            week_start=settings_dict.get("week_start"),
            language=settings_dict.get("language"),
            thousand_separator=settings_dict.get("thousand_separator"),
            decimal_separator=settings_dict.get("decimal_separator"),
        )
        
        currency_id = settings_dict.get("default_currency_id")
        if currency_id:
            currency = await currency_repository.get(db, id=currency_id)
            if currency:
                response.currency = CurrencyResponse.model_validate(currency)
                
        return response

    async def update_business_settings(self, db: AsyncSession, obj_in: BusinessSettingsUpdate) -> BusinessSettingsResponse:
        update_data = obj_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is None:
                continue
            setting = await setting_repository.get_by_key(db, key)
            if setting:
                await setting_repository.update(db, db_obj=setting, obj_in={"value": str(value)})
            else:
                await setting_repository.create(db, obj_in=SettingCreate(
                    key=key, value=str(value), group_name="business"
                ))
                
        return await self.get_business_settings(db)

setting_service = SettingService()
