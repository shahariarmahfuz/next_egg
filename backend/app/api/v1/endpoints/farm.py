import math
from datetime import date, datetime, timezone
import zoneinfo
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.permissions import RequirePermission
from app.dependencies.db import get_db
from app.models.user import User
from app.models.farm_transaction import FarmTransactionType
from app.schemas.common import ResponseModel, PaginatedResponse
from app.schemas.farm import (
    FarmProductionCreate,
    FarmDeliveryCreate,
    FarmWasteCreate,
    FarmTransactionResponse,
    FarmDashboardKPIs,
    FarmStockItem,
    FarmReportResponse,
)
from app.services.farm_service import farm_service
from app.repositories.farm_repository import farm_repository
from app.services.setting_service import setting_service

router = APIRouter()


async def get_business_today(db: AsyncSession) -> date:
    try:
        settings = await setting_service.get_business_settings(db)
        tz_str = settings.timezone or "UTC"
        tz = zoneinfo.ZoneInfo(tz_str)
        return datetime.now(tz).date()
    except Exception:
        return datetime.now(timezone.utc).date()


@router.post("/production", response_model=ResponseModel[FarmTransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_production(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmProductionCreate,
    current_user: User = Depends(RequirePermission("farm.production")),
):
    """Record a farm production entry (increases farm stock)."""
    txn = await farm_service.create_production(db, obj_in=obj_in)
    return ResponseModel[FarmTransactionResponse](
        success=True,
        message="Farm production recorded successfully",
        data=txn,
    )


@router.get("/production", response_model=ResponseModel[PaginatedResponse[FarmTransactionResponse]])
async def list_farm_production(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    product_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.view")),
):
    """Retrieve paginated farm production records."""
    skip = (page - 1) * size
    items, total = await farm_service.get_transactions(
        db,
        transaction_type=FarmTransactionType.PRODUCTION,
        start_date=start_date,
        end_date=end_date,
        product_id=product_id,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmTransactionResponse]](
        success=True,
        message="Farm production history retrieved successfully",
        data=PaginatedResponse[FarmTransactionResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.post("/delivery", response_model=ResponseModel[FarmTransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_delivery(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmDeliveryCreate,
    current_user: User = Depends(RequirePermission("farm.delivery")),
):
    """Record a farm delivery/distribution entry (decreases farm stock, no financial accounting)."""
    txn = await farm_service.create_delivery(db, obj_in=obj_in)
    return ResponseModel[FarmTransactionResponse](
        success=True,
        message="Farm delivery recorded successfully",
        data=txn,
    )


@router.get("/delivery", response_model=ResponseModel[PaginatedResponse[FarmTransactionResponse]])
async def list_farm_delivery(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    product_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.view")),
):
    """Retrieve paginated farm delivery/distribution records."""
    skip = (page - 1) * size
    items, total = await farm_service.get_transactions(
        db,
        transaction_type=FarmTransactionType.DELIVERY,
        start_date=start_date,
        end_date=end_date,
        product_id=product_id,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmTransactionResponse]](
        success=True,
        message="Farm delivery history retrieved successfully",
        data=PaginatedResponse[FarmTransactionResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.post("/waste", response_model=ResponseModel[FarmTransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_waste(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmWasteCreate,
    current_user: User = Depends(RequirePermission("farm.waste")),
):
    """Record farm product waste/loss (decreases farm stock, no automatic expense)."""
    txn = await farm_service.create_waste(db, obj_in=obj_in)
    return ResponseModel[FarmTransactionResponse](
        success=True,
        message="Farm waste recorded successfully",
        data=txn,
    )


@router.get("/waste", response_model=ResponseModel[PaginatedResponse[FarmTransactionResponse]])
async def list_farm_waste(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    product_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.view")),
):
    """Retrieve paginated farm waste records."""
    skip = (page - 1) * size
    items, total = await farm_service.get_transactions(
        db,
        transaction_type=FarmTransactionType.WASTE,
        start_date=start_date,
        end_date=end_date,
        product_id=product_id,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmTransactionResponse]](
        success=True,
        message="Farm waste history retrieved successfully",
        data=PaginatedResponse[FarmTransactionResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get("/dashboard", response_model=ResponseModel[FarmDashboardKPIs])
async def get_farm_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.view")),
):
    """Retrieve quantity-based Farm Dashboard KPIs using configured business timezone."""
    today = await get_business_today(db)
    kpis = await farm_repository.get_dashboard_kpis(db, today=today)
    return ResponseModel[FarmDashboardKPIs](
        success=True,
        message="Farm dashboard KPIs retrieved successfully",
        data=FarmDashboardKPIs(**kpis),
    )


@router.get("/stock", response_model=ResponseModel[List[FarmStockItem]])
async def get_farm_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.view")),
):
    """Retrieve current stock balances and quantity movements for all farm products."""
    stock_items = await farm_repository.get_farm_stock_overview(db)
    return ResponseModel[List[FarmStockItem]](
        success=True,
        message="Farm stock overview retrieved successfully",
        data=[FarmStockItem(**item) for item in stock_items],
    )


@router.get("/report", response_model=ResponseModel[FarmReportResponse])
async def get_farm_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("farm.report")),
):
    """Date-based Farm Report showing Production, Delivery, Waste, and Remaining Stock."""
    today = await get_business_today(db)
    if not start_date:
        start_date = today
    if not end_date:
        end_date = today

    report = await farm_repository.get_farm_report(db, start_date=start_date, end_date=end_date)
    return ResponseModel[FarmReportResponse](
        success=True,
        message="Farm report retrieved successfully",
        data=FarmReportResponse(**report),
    )

