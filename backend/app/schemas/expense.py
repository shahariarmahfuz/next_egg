from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# Category Schemas
class ExpenseCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    status: str = Field(default="active", pattern="^(active|inactive)$")


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")


class ExpenseCategoryResponse(ExpenseCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    expense_count: Optional[int] = 0


# Expense Schemas
class ExpenseBase(BaseModel):
    category_id: str
    amount: float = Field(..., gt=0)
    expense_date: datetime
    payment_method: str = Field(default="Cash")
    reference_no: Optional[str] = None
    description: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    reference_no: Optional[str] = None
    description: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    voucher_no: str
    created_by_id: str
    created_by_name: Optional[str] = None
    category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExpenseReportSummary(BaseModel):
    total_expenses: float
    today_expenses: float
    this_month_expenses: float
    this_year_expenses: float
    total_count: int
