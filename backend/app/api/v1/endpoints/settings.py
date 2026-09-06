from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_optional_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import ResponseModel
from app.schemas.setting import BusinessSettingsResponse, BusinessSettingsUpdate
from app.services.setting_service import setting_service

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("/business", response_model=ResponseModel[BusinessSettingsResponse])
async def get_business_settings(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Retrieve public and general business settings (for dashboard, formatting, and login)."""
    settings = await setting_service.get_business_settings(db)
    return ResponseModel[BusinessSettingsResponse](success=True, data=settings)

@router.put("/business", response_model=ResponseModel[BusinessSettingsResponse])
async def update_business_settings(
    settings_in: BusinessSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("settings.edit"))
):
    """
    Update business settings.
    Requires 'settings.edit' permission for general settings.
    Requires 'owner' role if any branding settings (logo, app icon, favicon, login logo) are updated.
    """
    settings = await setting_service.update_business_settings(db, obj_in=settings_in, current_user=current_user)
    return ResponseModel[BusinessSettingsResponse](success=True, data=settings)
