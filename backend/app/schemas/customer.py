from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_physical_page_number(v: Any) -> Optional[str]:
    """Normalize optional physical page input (supports text & numbers; blank becomes None)."""
    if v is None:
        return None
    if isinstance(v, int) and not isinstance(v, bool):
        v = str(v)
    if isinstance(v, str):
        stripped = v.strip()
        return stripped if stripped else None
    raise ValueError("Physical page number must be text or a number")


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Customer Full Name")
    phone: Optional[str] = Field(None, max_length=30, description="Optional customer phone")
    customer_code: Optional[str] = Field(None, max_length=50, description="Optional custom customer code")
    address: Optional[str] = None
    physical_page_number: Optional[str] = Field(
        None, max_length=50, description="Optional physical ledger page number"
    )
    opening_balance: float = Field(0.0, ge=0.0, description="Opening Due balance ($)")
    notes: Optional[str] = None

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Customer full name cannot be empty")
        return v.strip()

    @field_validator("physical_page_number", mode="before")
    def validate_physical_page_number(cls, v: Any) -> Optional[str]:
        return _normalize_physical_page_number(v)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    physical_page_number: Optional[str] = Field(
        None, max_length=50, description="Optional physical ledger page number"
    )
    status: Optional[str] = Field(None, description="active / inactive")
    notes: Optional[str] = None

    @field_validator("physical_page_number", mode="before")
    def validate_physical_page_number(cls, v: Any) -> Optional[str]:
        return _normalize_physical_page_number(v)


class CustomerPhysicalPageUpdate(BaseModel):
    physical_page_number: Optional[str] = Field(
        ..., max_length=50, description="Physical ledger page number (null/empty to clear)"
    )

    @field_validator("physical_page_number", mode="before")
    def validate_physical_page_number(cls, v: Any) -> Optional[str]:
        return _normalize_physical_page_number(v)


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
    physical_page_number: Optional[str] = None
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
    summary: Optional[CustomerLedgerSummary] = None
    transactions: list[CustomerLedgerTransaction]
    total: int = Field(ge=0, default=0, description="Total transaction count in filtered ledger")
    page: int = Field(ge=1, default=1, description="Current page number")
    page_size: int = Field(ge=1, default=25, description="Page size limit")
    pages: int = Field(ge=0, default=0, description="Total available pages")


class CustomerDuesSummary(BaseModel):
    total_customers: int
    total_amount: float
