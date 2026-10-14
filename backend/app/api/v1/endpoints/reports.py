from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import ResponseModel
from app.schemas.report import DailyCashReportResponse, DailyStockReportResponse
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["Reports Center"])


@router.get("", response_model=ResponseModel[dict])
@router.get("/overview", response_model=ResponseModel[dict])
async def get_reports_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("reports.view")),
):
    """Reports Center overview endpoint protected by reports.view permission."""
    return ResponseModel[dict](
        success=True,
        message="Reports Center access verified",
        data={
            "modules": [
                "sales",
                "sale_return",
                "purchase",
                "product_return",
                "customer_collection",
                "supplier_payment",
            ],
            "access": "granted",
        },
    )


@router.get("/stock", response_model=ResponseModel[DailyStockReportResponse])
async def get_daily_stock_report(
    product_id: str = Query(..., description="Product ID to generate report for"),
    target_date: str = Query(..., description="Target date in YYYY-MM-DD format"),
    client_timezone: Optional[str] = Query(None, alias="timezone", description="Optional client timezone"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("stock_report.view")),
):
    """
    Returns daily stock report for a selected product and date.
    Calculates Opening Stock, Purchases, Sales (with Cash/Due breakdown), and Remaining Stock.
    """
    report = await report_service.get_daily_stock_report(
        db=db,
        product_id=product_id,
        target_date_str=target_date,
        client_tz_str=client_timezone,
    )
    return ResponseModel[DailyStockReportResponse](
        success=True,
        message="Daily stock report generated successfully",
        data=report,
    )


@router.get("/cash-report", response_model=ResponseModel[DailyCashReportResponse])
async def get_daily_cash_report(
    target_date: Optional[str] = Query(None, description="Target date in YYYY-MM-DD format"),
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    client_timezone: Optional[str] = Query(None, alias="timezone", description="Optional client timezone"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("cash_report.view")),
):
    """
    Returns daily cash report (summary and breakdown):
    - Cash Inflow: Cash Sales (paid_amount > 0) + Customer Collections
    - Cash Outflow: Cash Outs (physical cash withdrawals) + Expenses
    - Net Remaining Cash: Cash In - Cash Out (Decimal precision)
    """
    report = await report_service.get_daily_cash_report(
        db=db,
        target_date_str=target_date,
        start_date_str=start_date,
        end_date_str=end_date,
        client_tz_str=client_timezone,
    )
    return ResponseModel[DailyCashReportResponse](
        success=True,
        message="Daily cash report generated successfully",
        data=report,
    )

