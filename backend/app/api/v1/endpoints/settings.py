from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.schemas.setting import BusinessSettingsResponse, BusinessSettingsUpdate
from app.services.setting_service import setting_service
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("/business", response_model=BusinessSettingsResponse)
async def get_business_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await setting_service.get_business_settings(db)

@router.put("/business", response_model=BusinessSettingsResponse)
async def update_business_settings(
    settings_in: BusinessSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await setting_service.update_business_settings(db, obj_in=settings_in)
