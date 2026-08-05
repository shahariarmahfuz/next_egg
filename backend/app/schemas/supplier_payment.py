from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.customer_collection import UserNestedResponse
from app.schemas.supplier import SupplierResponse


class SupplierPaymentCreate(BaseModel):
    supplier_id: str = Field(..., description="Target Supplier UUID")
    purchase_id: Optional[str] = Field(None, description="Optional Purchase Order UUID")
    amount: float = Field(..., gt=0.0, description="Payment Amount ($)")
    payment_method: str = Field("cash", description="Payment channel: cash, bank_transfer, cheque, card, mobile_wallet")
    reference_no: Optional[str] = Field(None, max_length=100, description="Bank transaction ref, cheque #, transaction ID")
    payment_date: Optional[datetime] = Field(None, description="Payment Transaction Date")
    notes: Optional[str] = Field(None, description="Payment notes")

    @field_validator("amount")
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v


class SupplierPaymentUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0.0)
    payment_method: Optional[str] = None
    reference_no: Optional[str] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None


class SupplierPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_no: str
    supplier_id: str
    purchase_id: Optional[str] = None
    user_id: str
    amount: float
    payment_method: str
    reference_no: Optional[str] = None
    payment_date: datetime
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    supplier: Optional[SupplierResponse] = None
    user: Optional[UserNestedResponse] = None


class SupplierFinancialSummary(BaseModel):
    supplier_id: str
    supplier_name: str
    supplier_code: str
    phone: str
    total_purchases: float
    total_paid: float
    current_due: float


class DailySupplierPaymentBreakdown(BaseModel):
    date: str
    total_amount: float
    count: int


class SupplierPaymentReportSummaryData(BaseModel):
    total_payments_count: int
    total_paid_amount: float
    today_amount: float
    yesterday_amount: float
    this_week_amount: float
    this_month_amount: float
    payment_method_breakdown: Dict[str, float]
    daily_breakdown: List[DailySupplierPaymentBreakdown]
