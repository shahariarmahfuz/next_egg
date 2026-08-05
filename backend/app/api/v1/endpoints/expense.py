import math
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import ResponseModel, PaginatedResponse
from app.schemas.expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseReportSummary,
)
from app.services.expense_service import expense_service

router = APIRouter(prefix="/expenses", tags=["Expenses"])


# --- CATEGORIES ENDPOINTS ---

@router.get("/categories", response_model=ResponseModel[List[ExpenseCategoryResponse]])
async def list_categories(
    active_only: bool = Query(False, description="Filter only active categories"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.category.view")),
):
    """Retrieve list of all expense categories."""
    categories = await expense_service.list_categories(db, active_only=active_only)
    return ResponseModel[List[ExpenseCategoryResponse]](
        success=True,
        message="Expense categories retrieved successfully",
        data=categories,
    )


@router.post("/categories", response_model=ResponseModel[ExpenseCategoryResponse], status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.category.create")),
):
    """Create a new expense category."""
    category = await expense_service.create_category(db, data)
    return ResponseModel[ExpenseCategoryResponse](
        success=True,
        message="Expense category created successfully",
        data=category,
    )


@router.put("/categories/{category_id}", response_model=ResponseModel[ExpenseCategoryResponse])
async def update_category(
    category_id: str,
    data: ExpenseCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.category.edit")),
):
    """Update an existing expense category."""
    category = await expense_service.update_category(db, category_id, data)
    return ResponseModel[ExpenseCategoryResponse](
        success=True,
        message="Expense category updated successfully",
        data=category,
    )


@router.delete("/categories/{category_id}", response_model=ResponseModel[dict])
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.category.delete")),
):
    """Delete an unused expense category."""
    await expense_service.delete_category(db, category_id)
    return ResponseModel[dict](
        success=True,
        message="Expense category deleted successfully",
        data={"id": category_id},
    )


# --- EXPENSE VOUCHER ENDPOINTS ---

@router.get("", response_model=ResponseModel[PaginatedResponse[ExpenseResponse]])
async def list_expenses(
    search: Optional[str] = Query(None, description="Search by voucher_no, reference_no, or description"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    start_date: Optional[datetime] = Query(None, description="Filter start date"),
    end_date: Optional[datetime] = Query(None, description="Filter end date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.view")),
):
    """Retrieve paginated list of expenses with filters."""
    items, total = await expense_service.list_expenses(
        db,
        search=search,
        category_id=category_id,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0

    paginated_data = PaginatedResponse[ExpenseResponse](
        items=items,
        total=total,
        page=page,
        size=page_size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[ExpenseResponse]](
        success=True,
        message="Expenses retrieved successfully",
        data=paginated_data,
    )


@router.post("", response_model=ResponseModel[ExpenseResponse], status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.create")),
):
    """Record a new expense entry."""
    expense = await expense_service.create_expense(db, data, user_id=current_user.id)
    return ResponseModel[ExpenseResponse](
        success=True,
        message="Expense recorded successfully",
        data=expense,
    )


@router.get("/report/summary", response_model=ResponseModel[ExpenseReportSummary])
async def get_report_summary(
    category_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.report.view")),
):
    """Retrieve expense metrics summary for report page."""
    summary = await expense_service.get_report_summary(
        db,
        category_id=category_id,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
    )
    return ResponseModel[ExpenseReportSummary](
        success=True,
        message="Expense report summary retrieved successfully",
        data=summary,
    )


@router.get("/{expense_id}", response_model=ResponseModel[ExpenseResponse])
async def get_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.view")),
):
    """Fetch single expense details by ID."""
    expense = await expense_service.get_expense(db, expense_id)
    return ResponseModel[ExpenseResponse](
        success=True,
        message="Expense retrieved successfully",
        data=expense,
    )


@router.put("/{expense_id}", response_model=ResponseModel[ExpenseResponse])
async def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.edit")),
):
    """Update an existing expense entry."""
    expense = await expense_service.update_expense(db, expense_id, data)
    return ResponseModel[ExpenseResponse](
        success=True,
        message="Expense updated successfully",
        data=expense,
    )


@router.delete("/{expense_id}", response_model=ResponseModel[dict])
async def delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.delete")),
):
    """Delete an expense entry."""
    await expense_service.delete_expense(db, expense_id)
    return ResponseModel[dict](
        success=True,
        message="Expense entry deleted successfully",
        data={"id": expense_id},
    )


@router.delete("/{expense_id}/hard-delete", response_model=ResponseModel[dict])
async def hard_delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("expense.delete")),
):
    """Hard delete expense entry permanently."""
    await expense_service.delete_expense(db, expense_id)
    return ResponseModel[dict](
        success=True,
        message="Expense entry deleted permanently",
        data={"id": expense_id},
    )
