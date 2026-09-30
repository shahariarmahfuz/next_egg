import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.supplier_other_transaction import (
    SupplierOtherTransactionCreate,
    SupplierOtherTransactionResponse,
    SupplierOtherTransactionUpdate,
)
from app.services.supplier_other_transaction_service import (
    supplier_other_transaction_service,
)

router = APIRouter(prefix="/supplier-other-transactions", tags=["Supplier Other Transactions"])


@router.post("", response_model=ResponseModel[SupplierOtherTransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_supplier_other_transaction(
    tx_in: SupplierOtherTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.create")),
):
    """
    Record an Other Payable transaction received from a supplier.
    Automatically increments supplier payable balance and registers on the supplier ledger.
    """
    tx = await supplier_other_transaction_service.create_transaction(
        db, user_id=current_user.id, tx_in=tx_in
    )
    return ResponseModel[SupplierOtherTransactionResponse](
        success=True,
        message="Supplier other transaction recorded successfully",
        data=SupplierOtherTransactionResponse.model_validate(tx),
    )


@router.get("", response_model=ResponseModel[PaginatedResponse[SupplierOtherTransactionResponse]])
async def list_supplier_other_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.view")),
):
    """Paginated list of supplier other transactions."""
    skip = (page - 1) * size
    items, total = await supplier_other_transaction_service.get_transactions_paginated(
        db,
        skip=skip,
        limit=size,
        search=search,
        supplier_id=supplier_id,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
    )
    pages = math.ceil(total / size) if total > 0 else 0

    return ResponseModel[PaginatedResponse[SupplierOtherTransactionResponse]](
        success=True,
        message="Supplier other transactions retrieved successfully",
        data=PaginatedResponse[SupplierOtherTransactionResponse](
            items=[SupplierOtherTransactionResponse.model_validate(t) for t in items],
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get("/{tx_id}", response_model=ResponseModel[SupplierOtherTransactionResponse])
async def get_supplier_other_transaction(
    tx_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.view")),
):
    """Get single supplier other transaction by ID."""
    tx = await supplier_other_transaction_service.get_transaction(db, tx_id=tx_id)
    return ResponseModel[SupplierOtherTransactionResponse](
        success=True,
        message="Supplier other transaction retrieved successfully",
        data=SupplierOtherTransactionResponse.model_validate(tx),
    )


@router.put("/{tx_id}", response_model=ResponseModel[SupplierOtherTransactionResponse])
async def update_supplier_other_transaction(
    tx_id: str,
    tx_in: SupplierOtherTransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.edit")),
):
    """
    Update a supplier other transaction.
    Automatically recalculates supplier payable balance.
    """
    tx = await supplier_other_transaction_service.update_transaction(
        db, user_id=current_user.id, tx_id=tx_id, tx_in=tx_in
    )
    return ResponseModel[SupplierOtherTransactionResponse](
        success=True,
        message="Supplier other transaction updated successfully",
        data=SupplierOtherTransactionResponse.model_validate(tx),
    )


@router.delete("/{tx_id}", response_model=ResponseModel[dict])
async def delete_supplier_other_transaction(
    tx_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("supplier.delete")),
):
    """Delete a supplier other transaction and reverse its balance impact."""
    await supplier_other_transaction_service.delete_transaction(
        db, user_id=current_user.id, tx_id=tx_id
    )
    return ResponseModel[dict](
        success=True,
        message="Supplier other transaction deleted and balance restored successfully",
        data={"id": tx_id},
    )
