from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.balance_adjustment import (
    BalanceAdjustmentCreate,
    BalanceAdjustmentResponse,
)
from app.schemas.common import ResponseModel
from app.services.balance_adjustment_service import balance_adjustment_service

router = APIRouter(tags=["Balance Adjustments"])


# Customer Balance Adjustments
@router.post(
    "/customers/{customer_id}/adjust-balance",
    response_model=ResponseModel[BalanceAdjustmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def adjust_customer_balance(
    customer_id: str,
    adj_in: BalanceAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["customer.balance.adjust", "customer.edit"])),
):
    """Set current balance for a customer directly with immutable audit logging."""
    adjustment = await balance_adjustment_service.adjust_customer_balance(
        db, current_user, customer_id, adj_in
    )
    return ResponseModel[BalanceAdjustmentResponse](
        success=True,
        message="Current balance updated successfully",
        data=BalanceAdjustmentResponse.model_validate(adjustment),
    )


@router.get(
    "/customers/{customer_id}/balance-adjustments",
    response_model=ResponseModel[List[BalanceAdjustmentResponse]],
)
async def get_customer_balance_adjustments(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["customer.view"])),
):
    """Get complete balance adjustment audit history for a customer."""
    adjustments = await balance_adjustment_service.get_adjustments_for_entity(
        db, "customer", customer_id
    )
    items = [BalanceAdjustmentResponse.model_validate(a) for a in adjustments]
    return ResponseModel[List[BalanceAdjustmentResponse]](
        success=True,
        message="Balance adjustment history retrieved",
        data=items,
    )


# Supplier Balance Adjustments
@router.post(
    "/suppliers/{supplier_id}/adjust-balance",
    response_model=ResponseModel[BalanceAdjustmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def adjust_supplier_balance(
    supplier_id: str,
    adj_in: BalanceAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["supplier.balance.adjust", "supplier.edit"])),
):
    """Set current balance for a supplier directly with immutable audit logging."""
    adjustment = await balance_adjustment_service.adjust_supplier_balance(
        db, current_user, supplier_id, adj_in
    )
    return ResponseModel[BalanceAdjustmentResponse](
        success=True,
        message="Current balance updated successfully",
        data=BalanceAdjustmentResponse.model_validate(adjustment),
    )


@router.get(
    "/suppliers/{supplier_id}/balance-adjustments",
    response_model=ResponseModel[List[BalanceAdjustmentResponse]],
)
async def get_supplier_balance_adjustments(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission(["supplier.view"])),
):
    """Get complete balance adjustment audit history for a supplier."""
    adjustments = await balance_adjustment_service.get_adjustments_for_entity(
        db, "supplier", supplier_id
    )
    items = [BalanceAdjustmentResponse.model_validate(a) for a in adjustments]
    return ResponseModel[List[BalanceAdjustmentResponse]](
        success=True,
        message="Balance adjustment history retrieved",
        data=items,
    )
