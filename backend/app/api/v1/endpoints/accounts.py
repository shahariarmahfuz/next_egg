from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.cash_book import CashBookSummary
from app.schemas.common import ResponseModel
from app.services.cash_book_service import cash_book_service

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
