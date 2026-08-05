from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.customer import CustomerResponse


class UserNestedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    username: str


class SaleNestedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_no: str
    grand_total: float
    paid_amount: float
    due_amount: float


class CustomerCollectionCreate(BaseModel):
    customer_id: str = Field(..., description="Target Customer UUID")
    amount: float = Field(..., gt=0.0, description="Collection Amount ($ > 0)")
    payment_method: str = Field(..., min_length=1, max_length=50, description="Payment method: cash, bank_transfer, cheque, card, etc.")
    collection_date: Optional[datetime] = Field(None, description="Collection Date (Defaults to current time)")
    reference_no: Optional[str] = Field(None, max_length=100, description="Optional payment reference number")
    sale_id: Optional[str] = Field(None, description="Optional linked Sale UUID")
    notes: Optional[str] = Field(None, description="Optional collection notes")

    @field_validator("amount")
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Collection amount must be greater than zero")
        return round(v, 2)

    @field_validator("payment_method")
    def validate_payment_method(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Payment method is required")
        return v.strip().lower()


class CustomerCollectionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0.0)
    payment_method: Optional[str] = Field(None, min_length=1, max_length=50)
    collection_date: Optional[datetime] = None
    reference_no: Optional[str] = Field(None, max_length=100)
    sale_id: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    def validate_amount(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Collection amount must be greater than zero")
        return round(v, 2) if v is not None else None


class CustomerCollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    collection_no: str
    customer_id: str
    sale_id: Optional[str] = None
    user_id: str
    amount: float
    payment_method: str
    reference_no: Optional[str] = None
    collection_date: datetime
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    customer: Optional[CustomerResponse] = None
    user: Optional[UserNestedResponse] = None
    sale: Optional[SaleNestedResponse] = None


class CustomerFinancialSummary(BaseModel):
    customer_id: str
    customer_code: str
    name: str
    phone: str
    current_due: float
    total_sales: float
    total_paid: float
    remaining_due: float


class PaymentMethodBreakdown(BaseModel):
    payment_method: str
    total_amount: float
    count: int


class DailyCollectionBreakdown(BaseModel):
    date: str
    total_amount: float
    count: int


class CollectionReportSummaryData(BaseModel):
    total_collections_count: int
    total_collected_amount: float
    today_amount: float
    yesterday_amount: float
    this_week_amount: float
    this_month_amount: float
    payment_method_breakdown: List[PaymentMethodBreakdown]
    daily_breakdown: List[DailyCollectionBreakdown]
