from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.exceptions.custom import ForbiddenException, NotFoundException
from app.models.user import User
from app.repositories.setting_repository import setting_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.setting import (
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
    SettingCreate,
    SupplierPrintConfigResponse,
    SupplierPrintConfigUpdate,
)

BRANDING_KEYS = {"business_logo", "app_icon_url", "favicon_url", "login_logo_url"}
SUPPLIER_PRINT_KEY = "supplier_print_supplier_id"

class SettingService:
    async def get_business_settings(
        self, db: AsyncSession, current_user: Optional[User] = None
    ) -> BusinessSettingsResponse:
        settings = await setting_repository.get_by_group(db, "business")
        settings_dict = {setting.key: setting.value for setting in settings}
        
        # Only Owner can see supplier_print_supplier_id
        supplier_print_id = None
        if current_user and current_user.role and current_user.role.code == "owner":
            supplier_print_id = settings_dict.get(SUPPLIER_PRINT_KEY)

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
            default_currency_id=settings_dict.get("default_currency_id"),
            supplier_print_supplier_id=supplier_print_id,
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

        # OWNER-ONLY SUPPLIER PRINT ENFORCEMENT
        if SUPPLIER_PRINT_KEY in update_data:
            if not current_user.role or current_user.role.code != "owner":
                raise ForbiddenException("Only the Owner is authorized to configure Supplier Print settings.")

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
                
        return await self.get_business_settings(db, current_user=current_user)

    async def get_supplier_print_config(
        self, db: AsyncSession, current_user: User
    ) -> SupplierPrintConfigResponse:
        if not current_user.role or current_user.role.code != "owner":
            raise ForbiddenException("Only the Owner is authorized to access Supplier Print configuration.")

        setting = await setting_repository.get_by_key(db, SUPPLIER_PRINT_KEY)
        supplier_id = setting.value.strip() if setting and setting.value and setting.value.strip() else None

        supplier_data = None
        if supplier_id:
            supplier = await supplier_repository.get_by_id(db, id=supplier_id)
            if supplier:
                supplier_data = {
                    "id": supplier.id,
                    "name": supplier.name,
                    "company_name": supplier.company_name,
                    "supplier_code": supplier.supplier_code,
                    "phone": supplier.phone,
                    "current_balance": supplier.current_balance,
                    "opening_balance": supplier.opening_balance,
                }

        return SupplierPrintConfigResponse(supplier_id=supplier_id, supplier=supplier_data)

    async def update_supplier_print_config(
        self, db: AsyncSession, obj_in: SupplierPrintConfigUpdate, current_user: User
    ) -> SupplierPrintConfigResponse:
        if not current_user.role or current_user.role.code != "owner":
            raise ForbiddenException("Only the Owner is authorized to modify Supplier Print configuration.")

        supplier_id = obj_in.supplier_id.strip() if obj_in.supplier_id and obj_in.supplier_id.strip() else None

        if supplier_id:
            supplier = await supplier_repository.get_by_id(db, id=supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

        setting = await setting_repository.get_by_key(db, SUPPLIER_PRINT_KEY)
        new_val = supplier_id or ""
        if setting:
            await setting_repository.update(db, db_obj=setting, obj_in={"value": new_val})
        else:
            await setting_repository.create(db, obj_in=SettingCreate(
                key=SUPPLIER_PRINT_KEY,
                value=new_val,
                group_name="business",
                description="Owner-selected supplier for Cash Book Print",
            ))

        return await self.get_supplier_print_config(db, current_user=current_user)

setting_service = SettingService()
