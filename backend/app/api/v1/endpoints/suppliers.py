import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierStatusUpdate, SupplierUpdate
from app.services.supplier_service import supplier_service

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("", response_model=ResponseModel[PaginatedResponse[SupplierResponse]])
async def list_suppliers(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    due_only: bool = Query(False, description="Set True to filter only suppliers with outstanding due (> 0)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.view")),
):
    """Server-side paginated supplier directory listing with search and status filtering."""
    skip = (page - 1) * size
    suppliers, total = await supplier_service.get_suppliers_paginated(
        db, skip=skip, limit=size, search=search, status=status, due_only=due_only
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [SupplierResponse.model_validate(s) for s in suppliers]
    paginated_data = PaginatedResponse[SupplierResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[SupplierResponse]](
        success=True,
        message="Suppliers retrieved successfully",
        data=paginated_data,
    )


@router.get("/dues", response_model=ResponseModel[PaginatedResponse[SupplierResponse]])
async def list_supplier_dues(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.view")),
):
    """Dedicated endpoint listing only suppliers with current due balance greater than zero (> 0)."""
    skip = (page - 1) * size
    suppliers, total = await supplier_service.get_suppliers_paginated(
        db, skip=skip, limit=size, search=search, status=None, due_only=True
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [SupplierResponse.model_validate(s) for s in suppliers]
    paginated_data = PaginatedResponse[SupplierResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[SupplierResponse]](
        success=True,
        message="Supplier dues retrieved successfully",
        data=paginated_data,
    )


@router.post("", response_model=ResponseModel[SupplierResponse], status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_in: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.create")),
):
    """Create a new supplier profile. Opening due automatically sets current due balance."""
    supplier = await supplier_service.create_supplier(db, supplier_in)
    return ResponseModel[SupplierResponse](
        success=True,
        message="Supplier created successfully",
        data=SupplierResponse.model_validate(supplier),
    )


@router.get("/{supplier_id}", response_model=ResponseModel[SupplierResponse])
async def get_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.view")),
):
    """Get single supplier details by ID."""
    supplier = await supplier_service.get_supplier(db, supplier_id)
    return ResponseModel[SupplierResponse](
        success=True,
        message="Supplier retrieved",
        data=SupplierResponse.model_validate(supplier),
    )


@router.put("/{supplier_id}", response_model=ResponseModel[SupplierResponse])
async def update_supplier(
    supplier_id: str,
    supplier_in: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.edit")),
):
    """Update supplier information and contact details."""
    supplier = await supplier_service.update_supplier(db, supplier_id, supplier_in)
    return ResponseModel[SupplierResponse](
        success=True,
        message="Supplier updated successfully",
        data=SupplierResponse.model_validate(supplier),
    )


@router.patch("/{supplier_id}/status", response_model=ResponseModel[SupplierResponse])
async def update_supplier_status(
    supplier_id: str,
    status_in: SupplierStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.edit")),
):
    """Quick status update for a supplier (active / inactive)."""
    supplier = await supplier_service.update_supplier_status(db, supplier_id, status_in.status)
    return ResponseModel[SupplierResponse](
        success=True,
        message="Supplier status updated successfully",
        data=SupplierResponse.model_validate(supplier),
    )


@router.delete("/{supplier_id}", response_model=ResponseModel[dict])
async def delete_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.delete")),
):
    """Delete supplier record."""
    await supplier_service.delete_supplier(db, supplier_id)
    return ResponseModel[dict](
        success=True,
        message="Supplier deleted successfully",
        data={"id": supplier_id},
    )


@router.delete("/{supplier_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.delete")),
):
    """Hard delete supplier profile and all related child transactions permanently."""
    await supplier_service.hard_delete_supplier(db, supplier_id)
    return ResponseModel[dict](
        success=True,
        message="Supplier and all related records deleted permanently",
        data={"id": supplier_id},
    )
