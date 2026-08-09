import math
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_
from app.models.purchase import Purchase
from app.models.supplier import Supplier

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.purchase import (
    PurchaseCreate,
    PurchaseReportSummary,
    PurchaseResponse,
    PurchaseUpdate,
)
from app.services.purchase_service import purchase_service

router = APIRouter(prefix="/purchases", tags=["Purchases"])


@router.get("", response_model=ResponseModel[PaginatedResponse[PurchaseResponse]])
async def list_purchases(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.view")),
):
    """Server-side paginated purchase order directory with search and status filtering."""
    skip = (page - 1) * size
    purchases, total = await purchase_service.get_purchases_paginated(
        db, skip=skip, limit=size, search=search, supplier_id=supplier_id, payment_status=payment_status, start_date=start_date, end_date=end_date
    )
    pages = math.ceil(total / size) if total > 0 else 0

    agg_query = select(
        func.count(Purchase.id).label("count"),
        func.coalesce(func.sum(Purchase.grand_total), 0.0).label("total_amount"),
        func.coalesce(func.sum(Purchase.paid_amount), 0.0).label("paid_amount"),
        func.coalesce(func.sum(Purchase.due_amount), 0.0).label("due_amount")
    )
    if search:
        pattern = f"%{search}%"
        agg_query = agg_query.join(Supplier, Purchase.supplier_id == Supplier.id, isouter=True).where(
            or_(
                Purchase.purchase_no.ilike(pattern),
                Purchase.invoice_no.ilike(pattern),
                Supplier.name.ilike(pattern),
                Supplier.supplier_code.ilike(pattern),
            )
        )
    if supplier_id:
        agg_query = agg_query.where(Purchase.supplier_id == supplier_id)
    if payment_status:
        agg_query = agg_query.where(Purchase.payment_status == payment_status)
    if start_date:
        agg_query = agg_query.where(Purchase.purchase_date >= start_date)
    if end_date:
        agg_query = agg_query.where(Purchase.purchase_date <= end_date)
        
    agg_res = await db.execute(agg_query)
    agg_row = agg_res.one()
    aggregate = {
        "count": agg_row.count,
        "total_amount": float(agg_row.total_amount),
        "paid_amount": float(agg_row.paid_amount),
        "due_amount": float(agg_row.due_amount),
    }

    items = [PurchaseResponse.model_validate(p) for p in purchases]
    paginated_data = PaginatedResponse[PurchaseResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
        aggregate=aggregate
    )

    return ResponseModel[PaginatedResponse[PurchaseResponse]](
        success=True,
        message="Purchases retrieved successfully",
        data=paginated_data,
    )


@router.get("/reports", response_model=ResponseModel[PurchaseReportSummary])
async def get_purchase_reports(
    report_type: str = Query("today", description="Options: today, date_wise, date_range, monthly"),
    target_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD for date_wise"),
    start_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD for date_range"),
    end_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD for date_range"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month number for monthly report"),
    year: Optional[int] = Query(None, ge=2020, description="Year for monthly report"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.report")),
):
    """Purchase summary report endpoint supporting Today, Date-Wise, Date Range, and Monthly filters."""
    summary = await purchase_service.generate_purchase_report(
        db,
        report_type=report_type,
        target_date=target_date,
        start_date_str=start_date,
        end_date_str=end_date,
        month=month,
        year=year,
    )

    return ResponseModel[PurchaseReportSummary](
        success=True,
        message="Purchase report generated successfully",
        data=summary,
    )


@router.post("", response_model=ResponseModel[PurchaseResponse], status_code=status.HTTP_201_CREATED)
async def create_purchase(
    purchase_in: PurchaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.create")),
):
    """Create a new purchase order. Automatically INCREASES product inventory stock levels."""
    purchase = await purchase_service.create_purchase(db, current_user.id, purchase_in)
    return ResponseModel[PurchaseResponse](
        success=True,
        message="Purchase completed and stock updated successfully",
        data=PurchaseResponse.model_validate(purchase),
    )


@router.get("/{purchase_id}", response_model=ResponseModel[PurchaseResponse])
async def get_purchase(
    purchase_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.view")),
):
    """Get single purchase order details with line items."""
    purchase = await purchase_service.get_purchase(db, purchase_id)
    return ResponseModel[PurchaseResponse](
        success=True,
        message="Purchase retrieved",
        data=PurchaseResponse.model_validate(purchase),
    )


@router.put("/{purchase_id}", response_model=ResponseModel[PurchaseResponse])
async def update_purchase(
    purchase_id: str,
    purchase_in: PurchaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.edit")),
):
    """Update purchase order and recalculate inventory stock levels."""
    purchase = await purchase_service.update_purchase(db, purchase_id, purchase_in)
    return ResponseModel[PurchaseResponse](
        success=True,
        message="Purchase updated and stock recalculated",
        data=PurchaseResponse.model_validate(purchase),
    )


@router.delete("/{purchase_id}", response_model=ResponseModel[dict])
async def delete_purchase(
    purchase_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.delete")),
):
    """Delete purchase order and REDUCE inventory stock automatically."""
    await purchase_service.delete_purchase(db, purchase_id)
    return ResponseModel[dict](
        success=True,
        message="Purchase deleted and stock reduced successfully",
        data={"id": purchase_id},
    )


@router.delete("/{purchase_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_purchase(
    purchase_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("purchase.delete")),
):
    """Hard delete purchase order and linked payments/returns permanently."""
    await purchase_service.hard_delete_purchase(db, purchase_id)
    return ResponseModel[dict](
        success=True,
        message="Purchase invoice and all dependent records deleted permanently",
        data={"id": purchase_id},
    )
