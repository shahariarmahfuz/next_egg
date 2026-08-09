import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_
from app.models.supplier_payment import SupplierPayment
from app.models.supplier import Supplier

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.supplier_payment import (
    SupplierFinancialSummary,
    SupplierPaymentCreate,
    SupplierPaymentReportSummaryData,
    SupplierPaymentResponse,
    SupplierPaymentUpdate,
)
from app.services.supplier_payment_service import supplier_payment_service

router = APIRouter(prefix="/supplier-payments", tags=["Supplier Payments"])


@router.get("", response_model=ResponseModel[PaginatedResponse[SupplierPaymentResponse]])
async def list_supplier_payments(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.view")),
):
    """Server-side paginated supplier payment directory with multi-field search and date range filtering."""
    skip = (page - 1) * size
    payments, total = await supplier_payment_service.get_supplier_payments_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        supplier_id=supplier_id,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    agg_query = select(
        func.count(SupplierPayment.id).label("count"),
        func.coalesce(func.sum(SupplierPayment.amount), 0.0).label("total_amount")
    )
    if search:
        pattern = f"%{search}%"
        agg_query = agg_query.join(Supplier, SupplierPayment.supplier_id == Supplier.id, isouter=True).where(
            or_(
                SupplierPayment.voucher_no.ilike(pattern),
                SupplierPayment.reference_no.ilike(pattern),
                Supplier.name.ilike(pattern),
            )
        )
    if supplier_id:
        agg_query = agg_query.where(SupplierPayment.supplier_id == supplier_id)
    if payment_method:
        agg_query = agg_query.where(SupplierPayment.payment_method == payment_method)
    if start_date:
        agg_query = agg_query.where(SupplierPayment.payment_date >= start_date)
    if end_date:
        agg_query = agg_query.where(SupplierPayment.payment_date <= end_date)
        
    agg_res = await db.execute(agg_query)
    agg_row = agg_res.one()
    aggregate = {
        "count": agg_row.count,
        "total_amount": float(agg_row.total_amount),
    }

    items = [SupplierPaymentResponse.model_validate(p) for p in payments]
    paginated_data = PaginatedResponse[SupplierPaymentResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
        aggregate=aggregate
    )

    return ResponseModel[PaginatedResponse[SupplierPaymentResponse]](
        success=True,
        message="Supplier payment vouchers retrieved successfully",
        data=paginated_data,
    )


@router.get("/supplier-summary/{supplier_id}", response_model=ResponseModel[SupplierFinancialSummary])
async def get_supplier_financial_summary(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["supplier_payment.view", "supplier_payment.create"])),
):
    """Calculates live financial summary metrics for a supplier (Total Purchase, Total Paid, Current Due)."""
    summary = await supplier_payment_service.get_supplier_financial_summary(db, supplier_id)
    return ResponseModel[SupplierFinancialSummary](
        success=True,
        message="Supplier financial summary retrieved successfully",
        data=SupplierFinancialSummary.model_validate(summary),
    )


@router.get("/reports", response_model=ResponseModel[SupplierPaymentReportSummaryData])
async def get_supplier_payment_reports(
    preset_range: Optional[str] = Query(None, description="today, yesterday, this_week, this_month, date_range"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.report")),
):
    """Calculates supplier payment report metrics, payment channel breakdown, and daily timeline."""
    report_data = await supplier_payment_service.get_supplier_payment_reports(
        db,
        preset_range=preset_range,
        start_date=start_date,
        end_date=end_date,
        search=search,
        supplier_id=supplier_id,
        payment_method=payment_method,
    )
    return ResponseModel[SupplierPaymentReportSummaryData](
        success=True,
        message="Supplier payment report generated successfully",
        data=SupplierPaymentReportSummaryData.model_validate(report_data),
    )


@router.post("", response_model=ResponseModel[SupplierPaymentResponse], status_code=status.HTTP_201_CREATED)
async def create_supplier_payment(
    payment_in: SupplierPaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.create")),
):
    """Process a new supplier payment voucher."""
    supplier_payment = await supplier_payment_service.create_supplier_payment(db, current_user.id, payment_in)
    return ResponseModel[SupplierPaymentResponse](
        success=True,
        message="Supplier payment voucher created successfully",
        data=SupplierPaymentResponse.model_validate(supplier_payment),
    )


@router.get("/{payment_id}", response_model=ResponseModel[SupplierPaymentResponse])
async def get_supplier_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.view")),
):
    """Get single supplier payment voucher details."""
    supplier_payment = await supplier_payment_service.get_supplier_payment(db, payment_id)
    return ResponseModel[SupplierPaymentResponse](
        success=True,
        message="Supplier payment voucher details retrieved",
        data=SupplierPaymentResponse.model_validate(supplier_payment),
    )


@router.put("/{payment_id}", response_model=ResponseModel[SupplierPaymentResponse])
async def update_supplier_payment(
    payment_id: str,
    payment_in: SupplierPaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.edit")),
):
    """Update supplier payment voucher details, automatically updating supplier due."""
    supplier_payment = await supplier_payment_service.update_supplier_payment(db, current_user.id, payment_id, payment_in)
    return ResponseModel[SupplierPaymentResponse](
        success=True,
        message="Supplier payment voucher updated successfully",
        data=SupplierPaymentResponse.model_validate(supplier_payment),
    )


@router.delete("/{payment_id}", response_model=ResponseModel[dict])
async def delete_supplier_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.delete")),
):
    """Delete supplier payment voucher, automatically restoring supplier due balance."""
    await supplier_payment_service.delete_supplier_payment(db, current_user.id, payment_id)
    return ResponseModel[dict](
        success=True,
        message="Supplier payment voucher deleted successfully",
        data={"id": payment_id},
    )


@router.delete("/{payment_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_supplier_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier_payment.delete")),
):
    """Hard delete supplier payment voucher permanently."""
    await supplier_payment_service.delete_supplier_payment(db, current_user.id, payment_id)
    return ResponseModel[dict](
        success=True,
        message="Supplier payment voucher deleted permanently",
        data={"id": payment_id},
    )
