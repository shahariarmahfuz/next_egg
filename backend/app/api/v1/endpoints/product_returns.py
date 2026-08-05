import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.product_return import (
    ProductReturnCreate,
    ProductReturnReportSummaryData,
    ProductReturnResponse,
    ProductReturnUpdate,
    PurchaseReturnableSummary,
)
from app.services.product_return_service import product_return_service

router = APIRouter(prefix="/product-returns", tags=["Product Returns"])


@router.get("", response_model=ResponseModel[PaginatedResponse[ProductReturnResponse]])
async def list_product_returns(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    purchase_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.view")),
):
    """Server-side paginated product return directory with search and date range filtering."""
    skip = (page - 1) * size
    returns, total = await product_return_service.get_product_returns_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        supplier_id=supplier_id,
        purchase_id=purchase_id,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [ProductReturnResponse.model_validate(r) for r in returns]
    paginated_data = PaginatedResponse[ProductReturnResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[ProductReturnResponse]](
        success=True,
        message="Product return vouchers retrieved successfully",
        data=paginated_data,
    )


@router.get("/reports", response_model=ResponseModel[ProductReturnReportSummaryData])
async def get_product_return_reports(
    preset_range: Optional[str] = Query(None, description="today, yesterday, this_week, this_month, date_range"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.report")),
):
    """Calculates product return report metrics and daily breakdown for date ranges."""
    report_data = await product_return_service.get_product_return_reports(
        db,
        preset_range=preset_range,
        start_date=start_date,
        end_date=end_date,
        search=search,
        supplier_id=supplier_id,
    )
    return ResponseModel[ProductReturnReportSummaryData](
        success=True,
        message="Product return report generated successfully",
        data=ProductReturnReportSummaryData.model_validate(report_data),
    )


@router.get("/returnable-info/{purchase_identifier}", response_model=ResponseModel[PurchaseReturnableSummary])
async def get_purchase_returnable_info(
    purchase_identifier: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["product_return.create", "product_return.view"])),
):
    """Retrieves purchase order items, purchased quantities, previously returned quantities, and remaining returnable quantities."""
    summary = await product_return_service.get_purchase_returnable_info(db, purchase_identifier)
    return ResponseModel[PurchaseReturnableSummary](
        success=True,
        message="Purchase returnable details retrieved",
        data=PurchaseReturnableSummary.model_validate(summary),
    )


@router.post("", response_model=ResponseModel[ProductReturnResponse], status_code=status.HTTP_201_CREATED)
async def create_product_return(
    return_in: ProductReturnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.create")),
):
    """Process a new product return voucher to supplier."""
    product_return = await product_return_service.create_product_return(db, current_user.id, return_in)
    return ResponseModel[ProductReturnResponse](
        success=True,
        message="Product return voucher created successfully",
        data=ProductReturnResponse.model_validate(product_return),
    )


@router.get("/{return_id}", response_model=ResponseModel[ProductReturnResponse])
async def get_product_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.view")),
):
    """Get single product return voucher details."""
    product_return = await product_return_service.get_product_return(db, return_id)
    return ResponseModel[ProductReturnResponse](
        success=True,
        message="Product return voucher details retrieved",
        data=ProductReturnResponse.model_validate(product_return),
    )


@router.put("/{return_id}", response_model=ResponseModel[ProductReturnResponse])
async def update_product_return(
    return_id: str,
    return_in: ProductReturnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.edit")),
):
    """Update product return voucher details, recalculating product stock and supplier due."""
    product_return = await product_return_service.update_product_return(db, current_user.id, return_id, return_in)
    return ResponseModel[ProductReturnResponse](
        success=True,
        message="Product return voucher updated successfully",
        data=ProductReturnResponse.model_validate(product_return),
    )


@router.delete("/{return_id}", response_model=ResponseModel[dict])
async def delete_product_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.delete")),
):
    """Delete product return voucher, restoring product stock and supplier due."""
    await product_return_service.delete_product_return(db, current_user.id, return_id)
    return ResponseModel[dict](
        success=True,
        message="Product return voucher deleted successfully",
        data={"id": return_id},
    )


@router.delete("/{return_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_product_return(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product_return.delete")),
):
    """Hard delete product return voucher permanently."""
    await product_return_service.delete_product_return(db, current_user.id, return_id)
    return ResponseModel[dict](
        success=True,
        message="Product return voucher deleted permanently",
        data={"id": return_id},
    )
