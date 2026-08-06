from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Customer Full Name")
    phone: Optional[str] = Field(None, max_length=30, description="Optional customer phone")
    customer_code: Optional[str] = Field(None, max_length=50, description="Optional custom customer code")
    address: Optional[str] = None
    opening_balance: float = Field(0.0, ge=0.0, description="Opening Due balance ($)")
    notes: Optional[str] = None

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Customer full name cannot be empty")
        return v.strip()


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    status: Optional[str] = Field(None, description="active / inactive")
    notes: Optional[str] = None


class CustomerStatusUpdate(BaseModel):
    status: str = Field(..., description="active or inactive")


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    nid: Optional[str] = None
    opening_balance: float
    current_balance: float
    credit_limit: float = 0.0
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CustomerLedgerTransaction(BaseModel):
    id: str
    date: datetime
    voucher_no: str
    type: str
    description: str
    debit: float
    credit: float
    running_balance: float
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None


class CustomerLedgerSummary(BaseModel):
    opening_balance: float
    total_sales: float
    total_collections: float
    total_returns: float
    manual_adjustments: float
    current_due: float


class CustomerLedgerResponse(BaseModel):
    customer: CustomerResponse
    summary: CustomerLedgerSummary
    transactions: list[CustomerLedgerTransaction]


class CustomerDuesSummary(BaseModel):
    total_customers: int
    total_amount: float
