import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.sale_return import (
    SaleReturnableSummary,
    SaleReturnCreate,
    SaleReturnReportSummaryData,
    SaleReturnResponse,
    SaleReturnUpdate,
)
from app.services.sale_return_service import sale_return_service

router = APIRouter(prefix="/sale-returns", tags=["Sale Returns"])


@router.get("", response_model=ResponseModel[PaginatedResponse[SaleReturnResponse]])
async def list_sale_returns(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    sale_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.view")),
):
    """Server-side paginated customer sale return directory with search and date range filtering."""
    skip = (page - 1) * size
    returns, total = await sale_return_service.get_sale_returns_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        customer_id=customer_id,
        sale_id=sale_id,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [SaleReturnResponse.model_validate(r) for r in returns]
    paginated_data = PaginatedResponse[SaleReturnResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[SaleReturnResponse]](
        success=True,
        message="Sale return vouchers retrieved successfully",
        data=paginated_data,
    )


@router.get("/reports", response_model=ResponseModel[SaleReturnReportSummaryData])
async def get_sale_return_reports(
    preset_range: Optional[str] = Query(None, description="today, yesterday, this_week, this_month, date_range"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.report")),
):
    """Calculates sale return report metrics and daily breakdown for date ranges."""
    report_data = await sale_return_service.get_sale_return_reports(
        db,
        preset_range=preset_range,
        start_date=start_date,
        end_date=end_date,
        search=search,
        customer_id=customer_id,
    )
    return ResponseModel[SaleReturnReportSummaryData](
        success=True,
        message="Sale return report generated successfully",
        data=SaleReturnReportSummaryData.model_validate(report_data),
    )


@router.get("/returnable-info/{sale_identifier}", response_model=ResponseModel[SaleReturnableSummary])
async def get_sale_returnable_info(
    sale_identifier: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["sale_return.create", "sale_return.view"])),
):
    """Retrieves original sale invoice items, sold quantities, previously returned quantities, and remaining returnable quantities."""
    summary = await sale_return_service.get_sale_returnable_info(db, sale_identifier)
    return ResponseModel[SaleReturnableSummary](
        success=True,
        message="Sale returnable details retrieved",
        data=SaleReturnableSummary.model_validate(summary),
    )


@router.post("", response_model=ResponseModel[SaleReturnResponse], status_code=status.HTTP_201_CREATED)
async def create_sale_return(
    return_in: SaleReturnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.create")),
):
    """Process a new customer sale return voucher."""
    sale_return = await sale_return_service.create_sale_return(db, current_user.id, return_in)
    return ResponseModel[SaleReturnResponse](
        success=True,
        message="Sale return voucher created successfully",
        data=SaleReturnResponse.model_validate(sale_return),
    )


@router.get("/{return_id}", response_model=ResponseModel[SaleReturnResponse])
async def get_sale_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.view")),
):
    """Get single sale return voucher details."""
    sale_return = await sale_return_service.get_sale_return(db, return_id)
    return ResponseModel[SaleReturnResponse](
        success=True,
        message="Sale return voucher details retrieved",
        data=SaleReturnResponse.model_validate(sale_return),
    )


@router.put("/{return_id}", response_model=ResponseModel[SaleReturnResponse])
async def update_sale_return(
    return_id: str,
    return_in: SaleReturnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.edit")),
):
    """Update sale return voucher details, recalculating product stock and customer due."""
    sale_return = await sale_return_service.update_sale_return(db, current_user.id, return_id, return_in)
    return ResponseModel[SaleReturnResponse](
        success=True,
        message="Sale return voucher updated successfully",
        data=SaleReturnResponse.model_validate(sale_return),
    )


@router.delete("/{return_id}", response_model=ResponseModel[dict])
async def delete_sale_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.delete")),
):
    """Delete sale return voucher, restoring product stock and customer due."""
    await sale_return_service.delete_sale_return(db, current_user.id, return_id)
    return ResponseModel[dict](
        success=True,
        message="Sale return voucher deleted successfully",
        data={"id": return_id},
    )


@router.delete("/{return_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_sale_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sale_return.delete")),
):
    """Hard delete sale return voucher permanently."""
    await sale_return_service.delete_sale_return(db, current_user.id, return_id)
    return ResponseModel[dict](
        success=True,
        message="Sale return voucher deleted permanently",
        data={"id": return_id},
    )
