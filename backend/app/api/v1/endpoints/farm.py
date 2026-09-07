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
from app.schemas.common import ResponseModel, PaginatedResponse
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    PreviousTrayUpdate,
    FarmResponse,
    FarmBalanceResponse,
    FarmDailyEntryCreate,
    FarmDailyEntryUpdate,
    FarmDailyEntryResponse,
    FarmProductionCreate,
    FarmProductionUpdate,
    FarmProductionResponse,
    FarmDeliveryCreate,
    FarmDeliveryBatchCreate,
    FarmDeliveryUpdate,
    FarmDeliveryResponse,
    FarmReportResponse,
    FarmLedgerResponse,
)
from app.services.farm_service import farm_service
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


# ==========================================
# FARM REGISTRATION & BALANCES
# ==========================================

@router.post("/farms", response_model=ResponseModel[FarmResponse], status_code=status.HTTP_201_CREATED)
async def create_farm(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmCreate,
    current_user: User = Depends(RequirePermission(["farm.create", "farm.manage"])),
):
    """Create a new farm location with minimum field 'name' and optional opening balance."""
    farm = await farm_service.create_farm(db, obj_in=obj_in)
    return ResponseModel[FarmResponse](
        success=True,
        message="Farm created successfully",
        data=farm,
    )


@router.get("/farms", response_model=ResponseModel[List[FarmBalanceResponse]])
async def list_farms(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.create", "farm.manage", "farm.production", "farm.delivery", "farm.report"])),
):
    """Retrieve all farms with calculated tray balances (previous, production, delivered, available)."""
    farms = await farm_service.get_all_farms_with_balances(db, status=status)
    return ResponseModel[List[FarmBalanceResponse]](
        success=True,
        message="Farms retrieved successfully",
        data=farms,
    )


@router.get("/farms/{farm_id}", response_model=ResponseModel[FarmResponse])
async def get_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.create", "farm.manage"])),
):
    """Get single farm details."""
    farm = await farm_service.get_farm_by_id(db, farm_id=farm_id)
    return ResponseModel[FarmResponse](
        success=True,
        message="Farm retrieved successfully",
        data=farm,
    )


@router.put("/farms/{farm_id}", response_model=ResponseModel[FarmResponse])
async def update_farm(
    farm_id: str,
    obj_in: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.create", "farm.manage"])),
):
    """Update farm details."""
    farm = await farm_service.update_farm(db, farm_id=farm_id, obj_in=obj_in)
    return ResponseModel[FarmResponse](
        success=True,
        message="Farm updated successfully",
        data=farm,
    )


@router.put("/farms/{farm_id}/previous-tray", response_model=ResponseModel[FarmBalanceResponse])
async def update_farm_previous_tray(
    farm_id: str,
    obj_in: PreviousTrayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.create", "farm.manage", "farm.view"])),
):
    """Update opening / previous tray balance for a farm."""
    updated = await farm_service.update_previous_tray(db, farm_id=farm_id, obj_in=obj_in)
    return ResponseModel[FarmBalanceResponse](
        success=True,
        message="Previous tray balance updated successfully",
        data=updated,
    )


@router.delete("/farms/{farm_id}", response_model=ResponseModel[dict])
async def delete_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.create"])),
):
    """Delete a farm and all associated records."""
    await farm_service.delete_farm(db, farm_id=farm_id)
    return ResponseModel[dict](
        success=True,
        message="Farm deleted successfully",
        data={"id": farm_id},
    )


@router.get("/farms/{farm_id}/ledger", response_model=ResponseModel[FarmLedgerResponse])
async def get_farm_ledger(
    farm_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.report", "farm.manage"])),
):
    """
    Retrieve chronological tray movement ledger for a farm with running balance.
    Opening tray + Production - Delivery = Running balance.
    """
    ledger = await farm_service.get_farm_ledger(
        db,
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
    )
    return ResponseModel[FarmLedgerResponse](
        success=True,
        message="Farm ledger retrieved successfully",
        data=ledger,
    )


# ==========================================
# UNIFIED FARM MANAGEMENT (DAILY TRANSACTIONS)
# ==========================================

@router.post("/entries", response_model=ResponseModel[FarmDailyEntryResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_entry(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmDailyEntryCreate,
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.create", "farm.production", "farm.delivery"])),
):
    """
    Create a unified daily farm transaction on a single page:
    Selected Date + Farm + Production Trays + Multiple Delivery Entries.
    Recalculates farm available tray balance.
    """
    entry = await farm_service.create_entry(db, obj_in=obj_in)
    return ResponseModel[FarmDailyEntryResponse](
        success=True,
        message="Farm entry recorded successfully",
        data=entry,
    )


@router.get("/entries", response_model=ResponseModel[PaginatedResponse[FarmDailyEntryResponse]])
async def list_farm_entries(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    farm_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.manage", "farm.create", "farm.production", "farm.delivery"])),
):
    """Retrieve paginated daily farm entries with attached deliveries."""
    skip = (page - 1) * size
    items, total = await farm_service.get_entries(
        db,
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmDailyEntryResponse]](
        success=True,
        message="Farm entries retrieved successfully",
        data=PaginatedResponse[FarmDailyEntryResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get("/entries/{entry_id}", response_model=ResponseModel[FarmDailyEntryResponse])
async def get_farm_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.manage"])),
):
    """Get single daily farm entry details including all delivery destination rows."""
    entry = await farm_service.get_entry_by_id(db, entry_id=entry_id)
    return ResponseModel[FarmDailyEntryResponse](
        success=True,
        message="Farm entry retrieved successfully",
        data=entry,
    )


@router.put("/entries/{entry_id}", response_model=ResponseModel[FarmDailyEntryResponse])
async def update_farm_entry(
    entry_id: str,
    obj_in: FarmDailyEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.create"])),
):
    """Update a daily farm entry and its delivery rows without creating duplicates."""
    updated = await farm_service.update_entry(db, entry_id=entry_id, obj_in=obj_in)
    return ResponseModel[FarmDailyEntryResponse](
        success=True,
        message="Farm entry updated successfully",
        data=updated,
    )


@router.delete("/entries/{entry_id}", response_model=ResponseModel[dict])
async def delete_farm_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.create"])),
):
    """Delete a daily farm entry and all its deliveries, correctly recalculating balance."""
    await farm_service.delete_entry(db, entry_id=entry_id)
    return ResponseModel[dict](
        success=True,
        message="Farm entry deleted successfully",
        data={"id": entry_id},
    )


# ==========================================
# FARM REPORT ENDPOINTS
# ==========================================

@router.get("/report", response_model=ResponseModel[FarmReportResponse])
async def get_farm_report(
    farm_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.report", "farm.view"])),
):
    """
    Date-wise Farm Report showing daily production and delivery breakdown by destination.
    Defaults to today's date if no date range is provided.
    Calculates aggregated totals over complete filtered dataset.
    """
    today = await get_business_today(db)
    if not start_date and not end_date:
        start_date = today
        end_date = today

    report = await farm_service.get_farm_report(
        db,
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
    )
    return ResponseModel[FarmReportResponse](
        success=True,
        message="Farm report retrieved successfully",
        data=report,
    )


# ==========================================
# LEGACY PRODUCTION ENDPOINTS
# ==========================================

@router.post("/production", response_model=ResponseModel[FarmProductionResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_production(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmProductionCreate,
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.production", "farm.production.create"])),
):
    prod = await farm_service.create_production(db, obj_in=obj_in)
    return ResponseModel[FarmProductionResponse](
        success=True,
        message="Farm production recorded successfully",
        data=prod,
    )


@router.get("/production", response_model=ResponseModel[PaginatedResponse[FarmProductionResponse]])
async def list_farm_production(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    farm_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.production", "farm.manage"])),
):
    skip = (page - 1) * size
    items, total = await farm_service.get_productions(
        db,
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmProductionResponse]](
        success=True,
        message="Farm production history retrieved successfully",
        data=PaginatedResponse[FarmProductionResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get("/production/{prod_id}", response_model=ResponseModel[FarmProductionResponse])
async def get_farm_production(
    prod_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.production", "farm.manage"])),
):
    prod = await farm_service.get_production_by_id(db, prod_id=prod_id)
    return ResponseModel[FarmProductionResponse](
        success=True,
        message="Production record retrieved successfully",
        data=prod,
    )


@router.put("/production/{prod_id}", response_model=ResponseModel[FarmProductionResponse])
async def update_farm_production(
    prod_id: str,
    obj_in: FarmProductionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.production"])),
):
    updated = await farm_service.update_production(db, prod_id=prod_id, obj_in=obj_in)
    return ResponseModel[FarmProductionResponse](
        success=True,
        message="Production record updated successfully",
        data=updated,
    )


@router.delete("/production/{prod_id}", response_model=ResponseModel[dict])
async def delete_farm_production(
    prod_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.production"])),
):
    await farm_service.delete_production(db, prod_id=prod_id)
    return ResponseModel[dict](
        success=True,
        message="Production record deleted successfully",
        data={"id": prod_id},
    )


# ==========================================
# LEGACY DELIVERY ENDPOINTS
# ==========================================

@router.post("/delivery", response_model=ResponseModel[FarmDeliveryResponse], status_code=status.HTTP_201_CREATED)
async def create_farm_delivery(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmDeliveryCreate,
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.delivery", "farm.delivery.create", "farm.create"])),
):
    """Record a single farm delivery."""
    delivery = await farm_service.create_delivery(db, obj_in=obj_in)
    return ResponseModel[FarmDeliveryResponse](
        success=True,
        message="Farm delivery recorded successfully",
        data=delivery,
    )


@router.post("/delivery/batch", response_model=ResponseModel[List[FarmDeliveryResponse]], status_code=status.HTTP_201_CREATED)
async def create_farm_delivery_batch(
    *,
    db: AsyncSession = Depends(get_db),
    obj_in: FarmDeliveryBatchCreate,
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.delivery", "farm.delivery.create", "farm.create"])),
):
    """Record multiple delivery destination entries at once."""
    deliveries = await farm_service.create_deliveries_batch(db, obj_in=obj_in)
    return ResponseModel[List[FarmDeliveryResponse]](
        success=True,
        message=f"{len(deliveries)} delivery entries recorded successfully",
        data=deliveries,
    )


@router.get("/delivery", response_model=ResponseModel[PaginatedResponse[FarmDeliveryResponse]])
async def list_farm_delivery(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    farm_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.delivery", "farm.manage"])),
):
    skip = (page - 1) * size
    items, total = await farm_service.get_deliveries(
        db,
        farm_id=farm_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    return ResponseModel[PaginatedResponse[FarmDeliveryResponse]](
        success=True,
        message="Farm delivery history retrieved successfully",
        data=PaginatedResponse[FarmDeliveryResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get("/delivery/{deliv_id}", response_model=ResponseModel[FarmDeliveryResponse])
async def get_farm_delivery(
    deliv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.view", "farm.delivery", "farm.manage"])),
):
    deliv = await farm_service.get_delivery_by_id(db, deliv_id=deliv_id)
    return ResponseModel[FarmDeliveryResponse](
        success=True,
        message="Delivery record retrieved successfully",
        data=deliv,
    )


@router.put("/delivery/{deliv_id}", response_model=ResponseModel[FarmDeliveryResponse])
async def update_farm_delivery(
    deliv_id: str,
    obj_in: FarmDeliveryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.delivery"])),
):
    updated = await farm_service.update_delivery(db, deliv_id=deliv_id, obj_in=obj_in)
    return ResponseModel[FarmDeliveryResponse](
        success=True,
        message="Delivery record updated successfully",
        data=updated,
    )


@router.delete("/delivery/{deliv_id}", response_model=ResponseModel[dict])
async def delete_farm_delivery(
    deliv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["farm.manage", "farm.delivery"])),
):
    await farm_service.delete_delivery(db, deliv_id=deliv_id)
    return ResponseModel[dict](
        success=True,
        message="Delivery record deleted successfully",
        data={"id": deliv_id},
    )
