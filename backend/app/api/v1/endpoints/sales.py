import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.sale import (
    SaleCreate,
    SaleReportSummary,
    SaleResponse,
    SaleUpdate,
)
from app.services.sale_service import sale_service

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("", response_model=ResponseModel[PaginatedResponse[SaleResponse]])
async def list_sales(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    sort_by: Optional[str] = Query("newest", description="newest, oldest, highest_amount, lowest_amount"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.view")),
):
    """Server-side paginated sales list with search, customer, payment status, date range, and sorting."""
    skip = (page - 1) * size
    sales, total = await sale_service.get_sales_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        customer_id=customer_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    # Fetch aggregate totals for the filtered dataset
    aggregate = await sale_service.get_sale_reports(
        db,
        search=search,
        customer_id=customer_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
    )

    items = [SaleResponse.model_validate(s) for s in sales]
    paginated_data = PaginatedResponse[SaleResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
        aggregate=aggregate
    )

    return ResponseModel[PaginatedResponse[SaleResponse]](
        success=True,
        message="Sales invoices retrieved successfully",
        data=paginated_data,
    )


@router.get("/reports", response_model=ResponseModel[SaleReportSummary])
async def get_sales_reports(
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.report.view")),
):
    """Generates aggregated sales metrics (total sales, total sale amount, total discount, total paid, total due, total items sold)."""
    summary = await sale_service.get_sale_reports(
        db,
        search=search,
        customer_id=customer_id,
        payment_status=payment_status,
        start_date=start_date,
        end_date=end_date,
    )
    return ResponseModel[SaleReportSummary](
        success=True,
        message="Sales report summary generated",
        data=SaleReportSummary(**summary),
    )


@router.post("", response_model=ResponseModel[SaleResponse], status_code=status.HTTP_201_CREATED)
async def create_sale(
    sale_in: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.create")),
):
    """
    Create a new Sale invoice.
    Automatically decreases product current_stock and updates customer due balance.
    Executes in a single atomic database transaction.
    """
    sale = await sale_service.create_sale(db, current_user.id, sale_in)
    return ResponseModel[SaleResponse](
        success=True,
        message="Sale invoice created successfully",
        data=SaleResponse.model_validate(sale),
    )


@router.get("/{sale_id}", response_model=ResponseModel[SaleResponse])
async def get_sale(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.view")),
):
    """Get single Sale invoice by UUID."""
    sale = await sale_service.get_sale(db, sale_id)
    return ResponseModel[SaleResponse](
        success=True,
        message="Sale invoice retrieved",
        data=SaleResponse.model_validate(sale),
    )


@router.put("/{sale_id}", response_model=ResponseModel[SaleResponse])
async def update_sale(
    sale_id: str,
    sale_in: SaleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.edit")),
):
    """
    Update Sale invoice details.
    Recalculates product stock differences and customer balance.
    """
    sale = await sale_service.update_sale(db, sale_id, sale_in)
    return ResponseModel[SaleResponse](
        success=True,
        message="Sale invoice updated successfully",
        data=SaleResponse.model_validate(sale),
    )


@router.delete("/{sale_id}", response_model=ResponseModel[dict])
async def delete_sale(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.delete")),
):
    """
    Delete Sale invoice.
    Restores product current_stock and reduces customer due balance.
    """
    await sale_service.delete_sale(db, sale_id)
    return ResponseModel[dict](
        success=True,
        message="Sale invoice deleted successfully",
        data={"id": sale_id},
    )


@router.delete("/{sale_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_sale(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("sales.delete")),
):
    """Hard delete Sale invoice and linked returns/collections permanently."""
    await sale_service.hard_delete_sale(db, sale_id)
    return ResponseModel[dict](
        success=True,
        message="Sale invoice and all dependent records deleted permanently",
        data={"id": sale_id},
    )
