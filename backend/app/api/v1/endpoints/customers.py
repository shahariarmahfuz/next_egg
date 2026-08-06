import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.customer import (
    CustomerCreate,
    CustomerLedgerResponse,
    CustomerResponse,
    CustomerStatusUpdate,
    CustomerUpdate,
    CustomerDuesSummary,
)
from app.services.customer_service import customer_service

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/{customer_id}/ledger", response_model=ResponseModel[CustomerLedgerResponse])
async def get_customer_ledger(
    customer_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.view")),
):
    """Retrieve complete financial statement / ledger for a customer."""
    ledger_data = await customer_service.get_customer_ledger(
        db, customer_id, start_date=start_date, end_date=end_date
    )
    return ResponseModel[CustomerLedgerResponse](
        success=True,
        message="Customer ledger retrieved successfully",
        data=ledger_data,
    )



@router.get("", response_model=ResponseModel[PaginatedResponse[CustomerResponse]])
async def list_customers(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.view")),
):
    """Server-side paginated customer directory with search and status filtering."""
    skip = (page - 1) * size
    customers, total = await customer_service.get_customers_paginated(
        db, skip=skip, limit=size, search=search, status=status, due_only=False
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [CustomerResponse.model_validate(c) for c in customers]
    paginated_data = PaginatedResponse[CustomerResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[CustomerResponse]](
        success=True,
        message="Customers retrieved successfully",
        data=paginated_data,
    )


@router.get("/dues/summary", response_model=ResponseModel[CustomerDuesSummary])
async def get_customer_dues_summary(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.due.view")),
):
    """Get total number of customers with due and the sum of their due amounts."""
    total_customers, total_amount = await customer_service.get_dues_summary(db, search=search)
    
    summary = CustomerDuesSummary(
        total_customers=total_customers,
        total_amount=total_amount,
    )
    
    return ResponseModel[CustomerDuesSummary](
        success=True,
        message="Customer dues summary retrieved successfully",
        data=summary,
    )


@router.get("/dues", response_model=ResponseModel[PaginatedResponse[CustomerResponse]])
async def list_customer_dues(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100000),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.due.view")),
):
    """Dedicated endpoint listing ONLY customers with outstanding due amount greater than zero."""
    skip = (page - 1) * size
    customers, total = await customer_service.get_customers_paginated(
        db, skip=skip, limit=size, search=search, due_only=True
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [CustomerResponse.model_validate(c) for c in customers]
    paginated_data = PaginatedResponse[CustomerResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[CustomerResponse]](
        success=True,
        message="Customer due list retrieved successfully",
        data=paginated_data,
    )


@router.post("", response_model=ResponseModel[CustomerResponse], status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.create")),
):
    """Create a new customer profile."""
    customer = await customer_service.create_customer(db, customer_in)
    return ResponseModel[CustomerResponse](
        success=True,
        message="Customer created successfully",
        data=CustomerResponse.model_validate(customer),
    )


@router.get("/{customer_id}", response_model=ResponseModel[CustomerResponse])
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.view")),
):
    """Get single customer profile by UUID."""
    customer = await customer_service.get_customer(db, customer_id)
    return ResponseModel[CustomerResponse](
        success=True,
        message="Customer retrieved",
        data=CustomerResponse.model_validate(customer),
    )


@router.put("/{customer_id}", response_model=ResponseModel[CustomerResponse])
async def update_customer(
    customer_id: str,
    customer_in: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.edit")),
):
    """Update customer details."""
    customer = await customer_service.update_customer(db, customer_id, customer_in)
    return ResponseModel[CustomerResponse](
        success=True,
        message="Customer updated successfully",
        data=CustomerResponse.model_validate(customer),
    )


@router.patch("/{customer_id}/status", response_model=ResponseModel[CustomerResponse])
async def update_customer_status(
    customer_id: str,
    status_in: CustomerStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.edit")),
):
    """Quick status update (active / inactive)."""
    customer = await customer_service.update_customer(
        db, customer_id, CustomerUpdate(status=status_in.status)
    )
    return ResponseModel[CustomerResponse](
        success=True,
        message="Customer status updated",
        data=CustomerResponse.model_validate(customer),
    )


@router.delete("/{customer_id}", response_model=ResponseModel[dict])
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.delete")),
):
    """Delete customer profile (blocked if active sales transactions exist)."""
    await customer_service.delete_customer(db, customer_id)
    return ResponseModel[dict](
        success=True,
        message="Customer deleted successfully",
        data={"id": customer_id},
    )


@router.delete("/{customer_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("customer.delete")),
):
    """Hard delete customer profile and all related child transactions permanently."""
    await customer_service.hard_delete_customer(db, customer_id)
    return ResponseModel[dict](
        success=True,
        message="Customer and all related records deleted permanently",
        data={"id": customer_id},
    )
