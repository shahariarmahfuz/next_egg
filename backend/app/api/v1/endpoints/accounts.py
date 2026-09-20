from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.cash_book import CashBookSummary
from app.schemas.cash_out import CashOutCreate, CashOutResponse, CashOutUpdate
from app.schemas.common import PaginatedResponse, ResponseModel
from app.services.cash_book_service import cash_book_service
from app.services.cash_out_service import cash_out_service

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get(
    "/cash-book",
    response_model=ResponseModel[CashBookSummary],
    dependencies=[Depends(RequirePermission(["accounts.cash_book.view", "reports.view"]))],
)
async def get_cash_book(
    target_date: Optional[str] = Query(
        None, description="Specific business date in YYYY-MM-DD format (defaults to today)"
    ),
    start_date: Optional[datetime] = Query(None, description="Optional start datetime filter"),
    end_date: Optional[datetime] = Query(None, description="Optional end datetime filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the authoritative daily Cash Book statement for the selected date or date range.
    Tracks all actual cash inflows and outflows chronologically with running cash balance.
    """
    summary = await cash_book_service.get_cash_book(
        db,
        target_date=target_date,
        start_date=start_date,
        end_date=end_date,
    )
    return ResponseModel[CashBookSummary](
        success=True,
        message="Cash book statement retrieved successfully.",
        data=summary,
    )


@router.post(
    "/cash-out",
    response_model=ResponseModel[CashOutResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RequirePermission(["accounts.cash_out.create", "accounts.cash_book.view"]))],
)
async def create_cash_out(
    data: CashOutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records a new Cash Out transaction (non-expense physical cash withdrawal).
    Reduces Cash Book balance without affecting Expenses, Profit, COGS, or Dues.
    """
    cash_out = await cash_out_service.create_cash_out(db, current_user.id, data)
    return ResponseModel[CashOutResponse](
        success=True,
        message="Cash out voucher recorded successfully.",
        data=cash_out,
    )


@router.get(
    "/cash-out",
    response_model=ResponseModel[PaginatedResponse[CashOutResponse]],
    dependencies=[Depends(RequirePermission(["cash_out.view", "accounts.cash_out.view"]))],
)
async def list_cash_outs(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists paginated Cash Out records with optional date range and text search.
    """
    skip = (page - 1) * size
    items, total = await cash_out_service.get_cash_outs(
        db, skip=skip, limit=size, start_date=start_date, end_date=end_date, search=search
    )
    pages = (total + size - 1) // size if total > 0 else 0
    return ResponseModel[PaginatedResponse[CashOutResponse]](
        success=True,
        message="Cash out records retrieved successfully.",
        data=PaginatedResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        ),
    )


@router.get(
    "/cash-out/{cash_out_id}",
    response_model=ResponseModel[CashOutResponse],
    dependencies=[Depends(RequirePermission(["cash_out.view", "accounts.cash_out.view"]))],
)
async def get_cash_out(
    cash_out_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves a single Cash Out voucher by ID.
    """
    cash_out = await cash_out_service.get_cash_out(db, cash_out_id)
    return ResponseModel[CashOutResponse](
        success=True,
        message="Cash out voucher retrieved successfully.",
        data=cash_out,
    )


@router.put(
    "/cash-out/{cash_out_id}",
    response_model=ResponseModel[CashOutResponse],
    dependencies=[Depends(RequirePermission(["cash_out.edit", "accounts.cash_out.edit"]))],
)
async def update_cash_out(
    cash_out_id: str,
    data: CashOutUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates an existing Cash Out voucher.
    """
    cash_out = await cash_out_service.update_cash_out(db, cash_out_id, data)
    return ResponseModel[CashOutResponse](
        success=True,
        message="Cash out voucher updated successfully.",
        data=cash_out,
    )


@router.delete(
    "/cash-out/{cash_out_id}",
    response_model=ResponseModel[dict],
    dependencies=[Depends(RequirePermission(["cash_out.delete", "accounts.cash_out.delete"]))],
)
async def delete_cash_out(
    cash_out_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes a Cash Out voucher.
    """
    await cash_out_service.delete_cash_out(db, cash_out_id)
    return ResponseModel[dict](
        success=True,
        message="Cash out voucher deleted successfully.",
        data={"id": cash_out_id},
    )

