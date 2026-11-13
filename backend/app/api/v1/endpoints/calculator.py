import math
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import get_business_tz, normalize_date_range
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.calculator_history import CalculatorHistory
from app.models.product import Product
from app.models.user import User
from app.schemas.calculator_history import CalculatorHistoryCreate, CalculatorHistoryResponse
from app.schemas.common import PaginatedResponse, ResponseModel
from app.services.setting_service import setting_service

router = APIRouter(prefix="/calculators", tags=["Calculators"])


async def _resolve_timezone_and_bounds(
    db: AsyncSession,
    target_date: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    show_all: bool,
    tz_override: Optional[str],
) -> Tuple[str, Optional[datetime], Optional[datetime], str]:
    """
    Resolves business timezone and UTC date bounds.
    Defaults to today's daily window unless `show_all=True` or explicit dates are given.
    """
    settings = await setting_service.get_business_settings(db)
    tz_str = tz_override if tz_override and tz_override != "UTC" else (settings.timezone or "Asia/Dhaka")
    tz = get_business_tz(tz_str)
    today_str = datetime.now(tz).date().isoformat()

    if target_date:
        try:
            clean = target_date.strip().split("T")[0]
            parsed_d = date.fromisoformat(clean)
        except ValueError:
            raise BadRequestException("Invalid target_date format. Expected YYYY-MM-DD.")
        start_local = datetime(parsed_d.year, parsed_d.month, parsed_d.day, 0, 0, 0, 0, tzinfo=tz)
        end_local = datetime(parsed_d.year, parsed_d.month, parsed_d.day, 23, 59, 59, 999999, tzinfo=tz)
        return tz_str, start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc), parsed_d.isoformat()

    if start_date is not None or end_date is not None:
        start_utc, end_utc = normalize_date_range(start_date, end_date, tz_str=tz_str, default_to_today=False)
        return tz_str, start_utc, end_utc, today_str

    if show_all:
        return tz_str, None, None, today_str

    start_utc, end_utc = normalize_date_range(None, None, tz_str=tz_str, default_to_today=True)
    return tz_str, start_utc, end_utc, today_str


def _build_base_conditions(
    user_id: str,
    calculator_type: Optional[str],
    start_utc: Optional[datetime],
    end_utc: Optional[datetime],
):
    conditions = [
        CalculatorHistory.user_id == user_id,
        CalculatorHistory.is_deleted == False,
    ]
    if calculator_type:
        conditions.append(CalculatorHistory.calculator_type == calculator_type)
    if start_utc is not None:
        conditions.append(CalculatorHistory.calculation_date >= start_utc)
    if end_utc is not None:
        conditions.append(CalculatorHistory.calculation_date <= end_utc)
    return conditions


@router.get("/history", response_model=ResponseModel[PaginatedResponse[CalculatorHistoryResponse]])
async def list_calculator_history(
    target_date: Optional[str] = Query(
        None, description="Specific business date in YYYY-MM-DD format (defaults to today when show_all is false)"
    ),
    start_date: Optional[datetime] = Query(None, description="Optional start datetime filter"),
    end_date: Optional[datetime] = Query(None, description="Optional end datetime filter"),
    show_all: bool = Query(False, description="When true and no date filters are given, returns history across all dates"),
    product_name: Optional[str] = Query(None, description="Optional filter by saved product name"),
    calculator_type: str = Query("egg", description="Calculator type"),
    timezone_param: Optional[str] = Query(None, alias="timezone", description="IANA timezone override"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("calculator.view")),
):
    """
    Retrieves per-user saved calculator history.
    Defaults to today's daily records in the business timezone, with support for date filtering and all-dates view.
    """
    tz_str, start_utc, end_utc, resolved_date = await _resolve_timezone_and_bounds(
        db, target_date, start_date, end_date, show_all, timezone_param
    )

    date_conditions = _build_base_conditions(current_user.id, calculator_type, start_utc, end_utc)

    # Distinct product options available within the user's selected date scope
    product_opts_stmt = (
        select(CalculatorHistory.product_name)
        .where(*date_conditions, CalculatorHistory.product_name.is_not(None))
        .distinct()
        .order_by(CalculatorHistory.product_name.asc())
    )
    product_options = [
        name for (name,) in (await db.execute(product_opts_stmt)).all() if name
    ]

    conditions = list(date_conditions)
    if product_name and product_name != "all":
        conditions.append(CalculatorHistory.product_name == product_name)

    total = (
        await db.execute(select(func.count(CalculatorHistory.id)).where(*conditions))
    ).scalar_one()

    stmt = (
        select(CalculatorHistory)
        .where(*conditions)
        .order_by(CalculatorHistory.calculation_date.desc(), CalculatorHistory.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [CalculatorHistoryResponse.model_validate(row) for row in rows]
    pages = math.ceil(total / size) if total > 0 else 0

    return ResponseModel[PaginatedResponse[CalculatorHistoryResponse]](
        success=True,
        message="Calculator history retrieved successfully",
        data=PaginatedResponse[CalculatorHistoryResponse](
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
            aggregate={
                "timezone": tz_str,
                "resolved_date": resolved_date,
                "show_all": show_all,
                "product_options": product_options,
            },
        ),
    )


@router.post(
    "/history",
    response_model=ResponseModel[CalculatorHistoryResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_calculator_history(
    data: CalculatorHistoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("calculator.view")),
):
    """Saves a calculation snapshot to the database scoped to the current authenticated user."""
    resolved_product_id: Optional[str] = None
    resolved_product_name = data.product_name

    if data.product_id:
        prod = (
            await db.execute(select(Product).where(Product.id == data.product_id))
        ).scalar_one_or_none()
        if prod is not None:
            resolved_product_id = prod.id
            if not resolved_product_name:
                resolved_product_name = prod.name

    calc_dt = data.calculation_date or datetime.now(timezone.utc)
    if calc_dt.tzinfo is None:
        calc_dt = calc_dt.replace(tzinfo=timezone.utc)

    entry = CalculatorHistory(
        user_id=current_user.id,
        calculator_type=data.calculator_type,
        calculation_date=calc_dt,
        product_id=resolved_product_id,
        product_name=resolved_product_name,
        system_stock=data.system_stock,
        eggs_per_tray=data.eggs_per_tray,
        stacks=[row.model_dump() for row in data.stacks],
        loose_entries=data.loose_entries.model_dump(),
        next_day_sell=data.next_day_sell,
        total_trays=data.total_trays,
        total_tray_eggs=data.total_tray_eggs,
        total_loose_eggs=data.total_loose_eggs,
        next_day_sell_eggs=data.next_day_sell_eggs,
        grand_total_eggs=data.grand_total_eggs,
        full_trays=data.full_trays,
        remainder_eggs=data.remainder_eggs,
        stock_difference=data.stock_difference,
        notes=data.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return ResponseModel[CalculatorHistoryResponse](
        success=True,
        message="Calculator history saved successfully",
        data=CalculatorHistoryResponse.model_validate(entry),
    )


@router.delete("/history/{history_id}", response_model=ResponseModel[dict])
async def delete_calculator_history_item(
    history_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("calculator.view")),
):
    """Soft-deletes a single calculator history item belonging to the current user."""
    entry = (
        await db.execute(
            select(CalculatorHistory).where(
                CalculatorHistory.id == history_id,
                CalculatorHistory.user_id == current_user.id,
                CalculatorHistory.is_deleted == False,
            )
        )
    ).scalar_one_or_none()

    if not entry:
        raise NotFoundException("Calculator history item not found")

    entry.is_deleted = True
    await db.commit()

    return ResponseModel[dict](
        success=True,
        message="Calculator history item deleted successfully",
        data={"id": history_id},
    )


@router.delete("/history", response_model=ResponseModel[dict])
async def clear_calculator_history(
    target_date: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    show_all: bool = Query(False),
    calculator_type: str = Query("egg"),
    timezone_param: Optional[str] = Query(None, alias="timezone"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("calculator.view")),
):
    """Soft-deletes all matching calculator history items belonging to the current user."""
    _, start_utc, end_utc, _ = await _resolve_timezone_and_bounds(
        db, target_date, start_date, end_date, show_all, timezone_param
    )
    conditions = _build_base_conditions(current_user.id, calculator_type, start_utc, end_utc)

    result = await db.execute(
        update(CalculatorHistory)
        .where(*conditions)
        .values(is_deleted=True, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return ResponseModel[dict](
        success=True,
        message="Calculator history cleared successfully",
        data={"deleted_count": result.rowcount or 0},
    )
