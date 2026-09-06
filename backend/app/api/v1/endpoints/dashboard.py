from typing import List
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.dependencies.auth import get_current_user
from app.exceptions.custom import ForbiddenException
from app.models.user import User
from app.schemas.common import ResponseModel
from app.schemas.dashboard import (
    DashboardCardsSummary,
    LowStockProductItem,
    RecentSaleItem,
)
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=ResponseModel[DashboardCardsSummary])
async def get_dashboard_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculates live summary metrics for Total Products, Customers, Suppliers, Sales, Purchases, and Dues."""
    is_filtered = start_date is not None or end_date is not None
    required_perm = "dashboard.filtered.view" if is_filtered else "dashboard.view"

    if current_user.role and current_user.role.code in ["owner", "super_admin"]:
        pass
    else:
        if not current_user.role or not current_user.role.permissions:
            raise ForbiddenException(f"Permission denied. Required permission: {required_perm}")
        user_permission_codes = {p.code for p in current_user.role.permissions}
        if required_perm not in user_permission_codes:
            raise ForbiddenException(f"Permission denied. Required permission: {required_perm}")

    summary = await dashboard_service.get_dashboard_summary(db, start_date=start_date, end_date=end_date)
    return ResponseModel[DashboardCardsSummary](
        success=True,
        message="Dashboard summary retrieved successfully",
        data=summary,
    )


@router.get("/recent-sales", response_model=ResponseModel[List[RecentSaleItem]])
async def get_recent_sales(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("dashboard.view")),
):
    """Fetches the latest sales transactions for the dashboard widget."""
    recent_sales = await dashboard_service.get_recent_sales(db, limit=10)
    return ResponseModel[List[RecentSaleItem]](
        success=True,
        message="Recent sales retrieved successfully",
        data=recent_sales,
    )


@router.get("/low-stock-products", response_model=ResponseModel[List[LowStockProductItem]])
async def get_low_stock_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("dashboard.view")),
):
    """Fetches products whose current stock level is below or equal to minimum stock."""
    low_stock = await dashboard_service.get_low_stock_products(db, limit=10)
    return ResponseModel[List[LowStockProductItem]](
        success=True,
        message="Low stock products retrieved successfully",
        data=low_stock,
    )
