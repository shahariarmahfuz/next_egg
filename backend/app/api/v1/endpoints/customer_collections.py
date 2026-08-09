import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_
from app.models.customer_collection import CustomerCollection
from app.models.customer import Customer

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.customer_collection import (
    CollectionReportSummaryData,
    CustomerCollectionCreate,
    CustomerCollectionResponse,
    CustomerCollectionUpdate,
    CustomerFinancialSummary,
)
from app.services.customer_collection_service import customer_collection_service

router = APIRouter(prefix="/collections", tags=["Customer Collections"])


@router.get("", response_model=ResponseModel[PaginatedResponse[CustomerCollectionResponse]])
async def list_collections(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.view")),
):
    """Server-side paginated customer collection voucher history with search and filtering."""
    skip = (page - 1) * size
    collections, total = await customer_collection_service.get_collections_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        customer_id=customer_id,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    agg_query = select(
        func.count(CustomerCollection.id).label("count"),
        func.coalesce(func.sum(CustomerCollection.amount), 0.0).label("total_amount")
    )
    if search:
        pattern = f"%{search}%"
        agg_query = agg_query.join(Customer, CustomerCollection.customer_id == Customer.id, isouter=True).where(
            or_(
                CustomerCollection.voucher_no.ilike(pattern),
                CustomerCollection.reference_no.ilike(pattern),
                Customer.name.ilike(pattern),
            )
        )
    if customer_id:
        agg_query = agg_query.where(CustomerCollection.customer_id == customer_id)
    if payment_method:
        agg_query = agg_query.where(CustomerCollection.payment_method == payment_method)
    if start_date:
        agg_query = agg_query.where(CustomerCollection.collection_date >= start_date)
    if end_date:
        agg_query = agg_query.where(CustomerCollection.collection_date <= end_date)
        
    agg_res = await db.execute(agg_query)
    agg_row = agg_res.one()
    aggregate = {
        "count": agg_row.count,
        "total_amount": float(agg_row.total_amount),
    }

    items = [CustomerCollectionResponse.model_validate(c) for c in collections]
    paginated_data = PaginatedResponse[CustomerCollectionResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
        aggregate=aggregate
    )

    return ResponseModel[PaginatedResponse[CustomerCollectionResponse]](
        success=True,
        message="Collection vouchers retrieved successfully",
        data=paginated_data,
    )


@router.get("/reports", response_model=ResponseModel[CollectionReportSummaryData])
async def get_collection_reports(
    preset_range: Optional[str] = Query(None, description="today, yesterday, this_week, this_month, date_range"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.report")),
):
    """Calculates collection report metrics and aggregates for date ranges and filters."""
    report_data = await customer_collection_service.get_collection_reports(
        db,
        preset_range=preset_range,
        start_date=start_date,
        end_date=end_date,
        search=search,
        customer_id=customer_id,
        payment_method=payment_method,
    )
    return ResponseModel[CollectionReportSummaryData](
        success=True,
        message="Collection report generated successfully",
        data=CollectionReportSummaryData.model_validate(report_data),
    )


@router.get("/customer-summary/{customer_id}", response_model=ResponseModel[CustomerFinancialSummary])
async def get_customer_financial_summary(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.view")),
):
    """Retrieve financial summary metrics for a selected customer (Current Due, Total Sales, Total Paid, Remaining Due)."""
    summary = await customer_collection_service.get_customer_summary(db, customer_id)
    return ResponseModel[CustomerFinancialSummary](
        success=True,
        message="Customer financial summary retrieved",
        data=CustomerFinancialSummary.model_validate(summary),
    )


@router.post("", response_model=ResponseModel[CustomerCollectionResponse], status_code=status.HTTP_201_CREATED)
async def create_collection(
    collection_in: CustomerCollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.create")),
):
    """Record a new customer dues collection payment."""
    collection = await customer_collection_service.create_collection(db, current_user.id, collection_in)
    return ResponseModel[CustomerCollectionResponse](
        success=True,
        message="Customer collection created successfully",
        data=CustomerCollectionResponse.model_validate(collection),
    )


@router.get("/{collection_id}", response_model=ResponseModel[CustomerCollectionResponse])
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.view")),
):
    """Get single collection voucher details."""
    collection = await customer_collection_service.get_collection(db, collection_id)
    return ResponseModel[CustomerCollectionResponse](
        success=True,
        message="Collection voucher details retrieved",
        data=CustomerCollectionResponse.model_validate(collection),
    )


@router.put("/{collection_id}", response_model=ResponseModel[CustomerCollectionResponse])
async def update_collection(
    collection_id: str,
    collection_in: CustomerCollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.edit")),
):
    """Update collection voucher details and automatically recalculate customer due."""
    collection = await customer_collection_service.update_collection(
        db, current_user.id, collection_id, collection_in
    )
    return ResponseModel[CustomerCollectionResponse](
        success=True,
        message="Collection updated successfully",
        data=CustomerCollectionResponse.model_validate(collection),
    )


@router.delete("/{collection_id}", response_model=ResponseModel[dict])
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.delete")),
):
    """Delete collection voucher and automatically restore customer due."""
    await customer_collection_service.delete_collection(db, current_user.id, collection_id)
    return ResponseModel[dict](
        success=True,
        message="Collection deleted successfully",
        data={"id": collection_id},
    )


@router.delete("/{collection_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("collection.delete")),
):
    """Hard delete collection voucher permanently."""
    await customer_collection_service.delete_collection(db, current_user.id, collection_id)
    return ResponseModel[dict](
        success=True,
        message="Collection voucher deleted permanently",
        data={"id": collection_id},
    )
