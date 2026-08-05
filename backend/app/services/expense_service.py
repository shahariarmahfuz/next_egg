from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.expense import Expense, ExpenseCategory
from app.schemas.expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCategoryResponse,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseReportSummary,
)


DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Office Rent", "description": "Monthly office premise rent payment"},
    {"name": "Electricity Bill", "description": "Electricity and utility charges"},
    {"name": "Internet Bill", "description": "Broadband and network connectivity costs"},
    {"name": "Employee Salary", "description": "Staff wages and payroll expenses"},
    {"name": "Transport", "description": "Local transport and travel expenses"},
    {"name": "Fuel", "description": "Vehicle and generator fuel charges"},
    {"name": "Maintenance", "description": "Office and equipment repair & maintenance"},
    {"name": "Marketing", "description": "Promotional campaigns and advertising costs"},
    {"name": "Miscellaneous", "description": "Other general operational expenses"},
]


class ExpenseService:
    # --- CATEGORIES ---

    async def ensure_default_categories(self, db: AsyncSession) -> None:
        """Seed default categories if table is empty."""
        res = await db.execute(select(func.count(ExpenseCategory.id)))
        count = res.scalar() or 0
        if count == 0:
            for cat in DEFAULT_EXPENSE_CATEGORIES:
                db_cat = ExpenseCategory(
                    name=cat["name"],
                    description=cat["description"],
                    status="active",
                )
                db.add(db_cat)
            await db.commit()

    async def list_categories(
        self, db: AsyncSession, active_only: bool = False
    ) -> List[ExpenseCategoryResponse]:
        await self.ensure_default_categories(db)
        query = select(ExpenseCategory).order_by(ExpenseCategory.name.asc())
        if active_only:
            query = query.where(ExpenseCategory.status == "active")

        result = await db.execute(query)
        categories = result.scalars().all()

        responses = []
        for cat in categories:
            # Count expenses for this category
            exp_count_res = await db.execute(
                select(func.count(Expense.id)).where(Expense.category_id == cat.id)
            )
            exp_count = exp_count_res.scalar() or 0

            responses.append(
                ExpenseCategoryResponse(
                    id=cat.id,
                    name=cat.name,
                    description=cat.description,
                    status=cat.status,
                    created_at=cat.created_at,
                    updated_at=cat.updated_at,
                    expense_count=exp_count,
                )
            )

        return responses

    async def create_category(
        self, db: AsyncSession, data: ExpenseCategoryCreate
    ) -> ExpenseCategoryResponse:
        # Check duplicate name
        existing = await db.execute(
            select(ExpenseCategory).where(func.lower(ExpenseCategory.name) == data.name.lower())
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Expense category with name '{data.name}' already exists.",
            )

        category = ExpenseCategory(
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            status=data.status,
        )
        db.add(category)
        await db.commit()
        await db.refresh(category)

        return ExpenseCategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            status=category.status,
            created_at=category.created_at,
            updated_at=category.updated_at,
            expense_count=0,
        )

    async def update_category(
        self, db: AsyncSession, category_id: str, data: ExpenseCategoryUpdate
    ) -> ExpenseCategoryResponse:
        result = await db.execute(select(ExpenseCategory).where(ExpenseCategory.id == category_id))
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense category not found.",
            )

        if data.name and data.name.lower() != category.name.lower():
            existing = await db.execute(
                select(ExpenseCategory).where(
                    func.lower(ExpenseCategory.name) == data.name.lower(),
                    ExpenseCategory.id != category_id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Expense category with name '{data.name}' already exists.",
                )
            category.name = data.name.strip()

        if data.description is not None:
            category.description = data.description.strip() if data.description else None

        if data.status is not None:
            category.status = data.status

        await db.commit()
        await db.refresh(category)

        exp_count_res = await db.execute(
            select(func.count(Expense.id)).where(Expense.category_id == category.id)
        )
        exp_count = exp_count_res.scalar() or 0

        return ExpenseCategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            status=category.status,
            created_at=category.created_at,
            updated_at=category.updated_at,
            expense_count=exp_count,
        )

    async def delete_category(self, db: AsyncSession, category_id: str) -> None:
        result = await db.execute(select(ExpenseCategory).where(ExpenseCategory.id == category_id))
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense category not found.",
            )

        # Check if category is used in any expense
        exp_res = await db.execute(
            select(func.count(Expense.id)).where(Expense.category_id == category_id)
        )
        if (exp_res.scalar() or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete category because it has associated expense entries. Set its status to inactive instead.",
            )

        await db.delete(category)
        await db.commit()

    # --- EXPENSES ---

    async def _generate_voucher_no(self, db: AsyncSession) -> str:
        query = select(Expense.voucher_no).order_by(Expense.created_at.desc()).limit(1)
        res = await db.execute(query)
        last_voucher = res.scalar_one_or_none()
        if not last_voucher:
            return "EXP-00001"

        try:
            numeric_part = int(last_voucher.replace("EXP-", ""))
            return f"EXP-{(numeric_part + 1):05d}"
        except ValueError:
            count_res = await db.execute(select(func.count(Expense.id)))
            count = (count_res.scalar() or 0) + 1
            return f"EXP-{count:05d}"

    async def create_expense(
        self, db: AsyncSession, data: ExpenseCreate, user_id: str
    ) -> ExpenseResponse:
        # Check category existence
        cat_res = await db.execute(
            select(ExpenseCategory).where(ExpenseCategory.id == data.category_id)
        )
        category = cat_res.scalar_one_or_none()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected expense category does not exist.",
            )

        voucher_no = await self._generate_voucher_no(db)

        expense = Expense(
            voucher_no=voucher_no,
            category_id=data.category_id,
            amount=round(data.amount, 2),
            expense_date=data.expense_date,
            payment_method=data.payment_method,
            reference_no=data.reference_no.strip() if data.reference_no else None,
            description=data.description.strip() if data.description else None,
            created_by_id=user_id,
        )

        db.add(expense)
        await db.commit()

        # Re-fetch with relationships loaded
        query = (
            select(Expense)
            .options(selectinload(Expense.category), selectinload(Expense.created_by))
            .where(Expense.id == expense.id)
        )
        res = await db.execute(query)
        saved_exp = res.scalar_one()

        return ExpenseResponse(
            id=saved_exp.id,
            voucher_no=saved_exp.voucher_no,
            category_id=saved_exp.category_id,
            amount=saved_exp.amount,
            expense_date=saved_exp.expense_date,
            payment_method=saved_exp.payment_method,
            reference_no=saved_exp.reference_no,
            description=saved_exp.description,
            created_by_id=saved_exp.created_by_id,
            created_by_name=saved_exp.created_by.full_name if saved_exp.created_by else "System",
            category_name=saved_exp.category.name if saved_exp.category else "Uncategorized",
            created_at=saved_exp.created_at,
            updated_at=saved_exp.updated_at,
        )

    async def list_expenses(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        category_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[ExpenseResponse], int]:
        query = select(Expense).options(
            selectinload(Expense.category), selectinload(Expense.created_by)
        )

        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Expense.voucher_no.ilike(search_pattern),
                    Expense.reference_no.ilike(search_pattern),
                    Expense.description.ilike(search_pattern),
                )
            )

        if category_id:
            query = query.where(Expense.category_id == category_id)

        if payment_method:
            query = query.where(Expense.payment_method == payment_method)

        if start_date:
            query = query.where(Expense.expense_date >= start_date)

        if end_date:
            query = query.where(Expense.expense_date <= end_date)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        count_res = await db.execute(count_query)
        total_count = count_res.scalar() or 0

        # Order & Paginate
        query = query.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        expenses = result.scalars().all()

        responses = [
            ExpenseResponse(
                id=e.id,
                voucher_no=e.voucher_no,
                category_id=e.category_id,
                amount=e.amount,
                expense_date=e.expense_date,
                payment_method=e.payment_method,
                reference_no=e.reference_no,
                description=e.description,
                created_by_id=e.created_by_id,
                created_by_name=e.created_by.full_name if e.created_by else "System",
                category_name=e.category.name if e.category else "Uncategorized",
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in expenses
        ]

        return responses, total_count

    async def get_expense(self, db: AsyncSession, expense_id: str) -> ExpenseResponse:
        query = (
            select(Expense)
            .options(selectinload(Expense.category), selectinload(Expense.created_by))
            .where(Expense.id == expense_id)
        )
        res = await db.execute(query)
        expense = res.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Expense entry not found."
            )

        return ExpenseResponse(
            id=expense.id,
            voucher_no=expense.voucher_no,
            category_id=expense.category_id,
            amount=expense.amount,
            expense_date=expense.expense_date,
            payment_method=expense.payment_method,
            reference_no=expense.reference_no,
            description=expense.description,
            created_by_id=expense.created_by_id,
            created_by_name=expense.created_by.full_name if expense.created_by else "System",
            category_name=expense.category.name if expense.category else "Uncategorized",
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        )

    async def update_expense(
        self, db: AsyncSession, expense_id: str, data: ExpenseUpdate
    ) -> ExpenseResponse:
        query = (
            select(Expense)
            .options(selectinload(Expense.category), selectinload(Expense.created_by))
            .where(Expense.id == expense_id)
        )
        res = await db.execute(query)
        expense = res.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Expense entry not found."
            )

        if data.category_id:
            cat_res = await db.execute(
                select(ExpenseCategory).where(ExpenseCategory.id == data.category_id)
            )
            if not cat_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Selected category does not exist."
                )
            expense.category_id = data.category_id

        if data.amount is not None:
            expense.amount = round(data.amount, 2)

        if data.expense_date is not None:
            expense.expense_date = data.expense_date

        if data.payment_method is not None:
            expense.payment_method = data.payment_method

        if data.reference_no is not None:
            expense.reference_no = data.reference_no.strip() if data.reference_no else None

        if data.description is not None:
            expense.description = data.description.strip() if data.description else None

        await db.commit()
        await db.refresh(expense)

        return ExpenseResponse(
            id=expense.id,
            voucher_no=expense.voucher_no,
            category_id=expense.category_id,
            amount=expense.amount,
            expense_date=expense.expense_date,
            payment_method=expense.payment_method,
            reference_no=expense.reference_no,
            description=expense.description,
            created_by_id=expense.created_by_id,
            created_by_name=expense.created_by.full_name if expense.created_by else "System",
            category_name=expense.category.name if expense.category else "Uncategorized",
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        )

    async def delete_expense(self, db: AsyncSession, expense_id: str) -> None:
        res = await db.execute(select(Expense).where(Expense.id == expense_id))
        expense = res.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Expense entry not found."
            )

        await db.delete(expense)
        await db.commit()

    # --- REPORTS & SUMMARY ---

    async def get_report_summary(
        self,
        db: AsyncSession,
        category_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> ExpenseReportSummary:
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)

        base_query = select(Expense)
        if category_id:
            base_query = base_query.where(Expense.category_id == category_id)
        if payment_method:
            base_query = base_query.where(Expense.payment_method == payment_method)

        # Filtered Total
        filtered_query = base_query
        if start_date:
            filtered_query = filtered_query.where(Expense.expense_date >= start_date)
        if end_date:
            filtered_query = filtered_query.where(Expense.expense_date <= end_date)

        total_res = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0.0)).select_from(
                filtered_query.subquery()
            )
        )
        total_expenses = float(total_res.scalar() or 0.0)

        count_res = await db.execute(
            select(func.count(Expense.id)).select_from(filtered_query.subquery())
        )
        total_count = count_res.scalar() or 0

        # Today's expenses
        today_query = base_query.where(Expense.expense_date >= today_start)
        today_res = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0.0)).select_from(
                today_query.subquery()
            )
        )
        today_expenses = float(today_res.scalar() or 0.0)

        # This month's expenses
        month_query = base_query.where(Expense.expense_date >= month_start)
        month_res = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0.0)).select_from(
                month_query.subquery()
            )
        )
        this_month_expenses = float(month_res.scalar() or 0.0)

        # This year's expenses
        year_query = base_query.where(Expense.expense_date >= year_start)
        year_res = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0.0)).select_from(
                year_query.subquery()
            )
        )
        this_year_expenses = float(year_res.scalar() or 0.0)

        return ExpenseReportSummary(
            total_expenses=round(total_expenses, 2),
            today_expenses=round(today_expenses, 2),
            this_month_expenses=round(this_month_expenses, 2),
            this_year_expenses=round(this_year_expenses, 2),
            total_count=total_count,
        )


expense_service = ExpenseService()
