import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductStatusUpdate,
    ProductUpdate,
)
from app.services.product_service import product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ResponseModel[PaginatedResponse[ProductResponse]])
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.view")),
):
    """Server-side paginated product catalog directory with search, category, brand, and status filtering."""
    skip = (page - 1) * size
    products, total = await product_service.get_products_paginated(
        db, skip=skip, limit=size, search=search, category=category, brand=brand, status=status
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [ProductResponse.model_validate(p) for p in products]
    paginated_data = PaginatedResponse[ProductResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[ProductResponse]](
        success=True,
        message="Products retrieved successfully",
        data=paginated_data,
    )


@router.get("/categories", response_model=ResponseModel[list[str]])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.view")),
):
    """Get list of unique product categories."""
    categories = await product_service.get_categories(db)
    return ResponseModel[list[str]](
        success=True,
        message="Categories retrieved",
        data=categories,
    )


@router.post("", response_model=ResponseModel[ProductResponse], status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.create")),
):
    """Create a new product catalog item."""
    product = await product_service.create_product(db, product_in)
    return ResponseModel[ProductResponse](
        success=True,
        message="Product created successfully",
        data=ProductResponse.model_validate(product),
    )


@router.get("/{product_id}", response_model=ResponseModel[ProductResponse])
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.view")),
):
    """Get single product profile by UUID."""
    product = await product_service.get_product(db, product_id)
    return ResponseModel[ProductResponse](
        success=True,
        message="Product retrieved",
        data=ProductResponse.model_validate(product),
    )


@router.put("/{product_id}", response_model=ResponseModel[ProductResponse])
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.edit")),
):
    """Update product profile attributes (Stock cannot be modified directly here)."""
    product = await product_service.update_product(db, product_id, product_in)
    return ResponseModel[ProductResponse](
        success=True,
        message="Product updated successfully",
        data=ProductResponse.model_validate(product),
    )


@router.patch("/{product_id}/status", response_model=ResponseModel[ProductResponse])
async def update_product_status(
    product_id: str,
    status_in: ProductStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.edit")),
):
    """Quick status toggle (active / inactive)."""
    product = await product_service.update_product(
        db, product_id, ProductUpdate(status=status_in.status)
    )
    return ResponseModel[ProductResponse](
        success=True,
        message="Product status updated",
        data=ProductResponse.model_validate(product),
    )


@router.delete("/{product_id}", response_model=ResponseModel[dict])
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.delete")),
):
    """Delete product profile."""
    await product_service.delete_product(db, product_id)
    return ResponseModel[dict](
        success=True,
        message="Product deleted successfully",
        data={"id": product_id},
    )


@router.delete("/{product_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("product.delete")),
):
    """Hard delete product profile and all transaction line items permanently."""
    await product_service.hard_delete_product(db, product_id)
    return ResponseModel[dict](
        success=True,
        message="Product and all related transaction items deleted permanently",
        data={"id": product_id},
    )
