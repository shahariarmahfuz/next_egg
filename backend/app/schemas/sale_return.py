from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.customer import CustomerResponse
from app.schemas.customer_collection import UserNestedResponse
from app.schemas.product import ProductResponse


class SaleNestedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_no: str
    grand_total: float
    paid_amount: float
    due_amount: float


class SaleReturnItemCreate(BaseModel):
    product_id: str = Field(..., description="Target Product UUID")
    quantity: float = Field(..., gt=0.0, description="Returned Quantity (> 0)")
    unit_price: float = Field(..., ge=0.0, description="Unit Price ($)")

    @field_validator("quantity")
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Returned quantity must be greater than zero")
        return v


class SaleReturnItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sale_return_id: str
    product_id: str
    quantity: float
    unit_price: float
    total_price: float
    created_at: datetime
    updated_at: datetime

    product: Optional[ProductResponse] = None


class SaleReturnCreate(BaseModel):
    sale_id: Optional[str] = Field(None, description="Linked Sale Invoice UUID")
    customer_id: str = Field(..., description="Target Customer UUID")
    return_date: Optional[datetime] = Field(None, description="Return Transaction Date")
    refund_amount: float = Field(0.0, ge=0.0, description="Cash refund amount paid back to customer ($)")
    reason: Optional[str] = Field(None, description="Return reason/notes")
    items: List[SaleReturnItemCreate] = Field(..., min_length=1, description="List of returned line items")

    @field_validator("items")
    def validate_items(cls, v: List[SaleReturnItemCreate]) -> List[SaleReturnItemCreate]:
        if not v or len(v) == 0:
            raise ValueError("Sale return voucher must contain at least one line item")
        return v


class SaleReturnUpdate(BaseModel):
    refund_amount: Optional[float] = Field(None, ge=0.0)
    reason: Optional[str] = None
    items: Optional[List[SaleReturnItemCreate]] = None


class SaleReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    return_no: str
    sale_id: Optional[str] = None
    customer_id: str
    user_id: str
    return_date: datetime
    grand_total: float
    refund_amount: float
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    customer: Optional[CustomerResponse] = None
    sale: Optional[SaleNestedResponse] = None
    user: Optional[UserNestedResponse] = None
    items: List[SaleReturnItemResponse] = []


class SaleReturnableItem(BaseModel):
    product_id: str
    product_name: str
    product_code: str
    unit: str
    sold_quantity: float
    previously_returned_qty: float
    returnable_qty: float
    unit_price: float


class SaleReturnableSummary(BaseModel):
    sale_id: str
    invoice_no: str
    sale_date: datetime
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_code: str
    grand_total: float
    paid_amount: float
    due_amount: float
    items: List[SaleReturnableItem]


class DailyReturnBreakdown(BaseModel):
    date: str
    total_amount: float
    count: int


class SaleReturnReportSummaryData(BaseModel):
    total_returns_count: int
    total_returned_amount: float
    total_refund_amount: float
    today_amount: float
    yesterday_amount: float
    this_week_amount: float
    this_month_amount: float
    daily_breakdown: List[DailyReturnBreakdown]
