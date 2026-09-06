from sqlalchemy.ext.asyncio import AsyncSession
from app.exceptions.custom import ForbiddenException
from app.models.user import User
from app.repositories.setting_repository import setting_repository
from app.schemas.setting import BusinessSettingsResponse, BusinessSettingsUpdate, SettingCreate

BRANDING_KEYS = {"business_logo", "app_icon_url", "favicon_url", "login_logo_url"}

class SettingService:
    async def get_business_settings(self, db: AsyncSession) -> BusinessSettingsResponse:
        settings = await setting_repository.get_by_group(db, "business")
        settings_dict = {setting.key: setting.value for setting in settings}
        
        response = BusinessSettingsResponse(
            business_name=settings_dict.get("business_name"),
            business_logo=settings_dict.get("business_logo"),
            app_icon_url=settings_dict.get("app_icon_url"),
            favicon_url=settings_dict.get("favicon_url"),
            login_logo_url=settings_dict.get("login_logo_url"),
            business_address=settings_dict.get("business_address"),
            business_phone=settings_dict.get("business_phone"),
            business_email=settings_dict.get("business_email"),
            website=settings_dict.get("website"),
            timezone=settings_dict.get("timezone"),
            date_format=settings_dict.get("date_format"),
            time_format=settings_dict.get("time_format"),
            week_start=settings_dict.get("week_start"),
            language=settings_dict.get("language"),
            thousand_separator=settings_dict.get("thousand_separator"),
            decimal_separator=settings_dict.get("decimal_separator"),
            default_currency_id=settings_dict.get("default_currency_id")
        )
                
        return response

    async def update_business_settings(
        self, db: AsyncSession, obj_in: BusinessSettingsUpdate, current_user: User
    ) -> BusinessSettingsResponse:
        update_data = obj_in.model_dump(exclude_unset=True)

        # OWNER-ONLY BRANDING ENFORCEMENT
        branding_modified = any(k in update_data for k in BRANDING_KEYS)
        if branding_modified:
            if not current_user.role or current_user.role.code != "owner":
                raise ForbiddenException("Only the Owner is authorized to modify business branding settings.")

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
