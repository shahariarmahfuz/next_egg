from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("dashboard.view")),
):
    """Calculates live summary metrics for Total Products, Customers, Suppliers, Sales, Purchases, and Dues."""
    summary = await dashboard_service.get_dashboard_summary(db)
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
