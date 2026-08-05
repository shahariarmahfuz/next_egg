from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.customer_collection import UserNestedResponse
from app.schemas.product import ProductResponse
from app.schemas.supplier import SupplierResponse


class PurchaseNestedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purchase_no: str
    invoice_no: Optional[str] = None
    grand_total: float
    paid_amount: float
    due_amount: float


class ProductReturnItemCreate(BaseModel):
    product_id: str = Field(..., description="Target Product UUID")
    quantity: float = Field(..., gt=0.0, description="Returned Quantity (> 0)")
    unit_price: float = Field(..., ge=0.0, description="Unit Cost / Purchase Return Price ($)")
    notes: Optional[str] = Field(None, description="Item return reason/notes")

    @field_validator("quantity")
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Returned quantity must be greater than zero")
        return v


class ProductReturnItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_return_id: str
    product_id: str
    quantity: float
    unit_price: float
    total_price: float
    created_at: datetime
    updated_at: datetime

    product: Optional[ProductResponse] = None


class ProductReturnCreate(BaseModel):
    purchase_id: Optional[str] = Field(None, description="Linked Purchase Order UUID")
    supplier_id: str = Field(..., description="Target Supplier UUID")
    return_date: Optional[datetime] = Field(None, description="Return Transaction Date")
    refund_received: float = Field(0.0, ge=0.0, description="Cash refund amount received from supplier ($)")
    reason: Optional[str] = Field(None, description="Return reason / notes")
    items: List[ProductReturnItemCreate] = Field(..., min_length=1, description="List of returned line items")

    @field_validator("items")
    def validate_items(cls, v: List[ProductReturnItemCreate]) -> List[ProductReturnItemCreate]:
        if not v or len(v) == 0:
            raise ValueError("Product return voucher must contain at least one line item")
        return v


class ProductReturnUpdate(BaseModel):
    refund_received: Optional[float] = Field(None, ge=0.0)
    reason: Optional[str] = None
    items: Optional[List[ProductReturnItemCreate]] = None


class ProductReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    return_no: str
    purchase_id: Optional[str] = None
    supplier_id: str
    user_id: str
    return_date: datetime
    grand_total: float
    refund_received: float
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    supplier: Optional[SupplierResponse] = None
    purchase: Optional[PurchaseNestedResponse] = None
    user: Optional[UserNestedResponse] = None
    items: List[ProductReturnItemResponse] = []


class PurchaseReturnableItem(BaseModel):
    product_id: str
    product_name: str
    product_code: str
    unit: str
    purchased_quantity: float
    previously_returned_qty: float
    returnable_qty: float
    unit_price: float


class PurchaseReturnableSummary(BaseModel):
    purchase_id: str
    purchase_no: str
    invoice_no: Optional[str] = None
    purchase_date: datetime
    supplier_id: str
    supplier_name: str
    supplier_phone: str
    supplier_code: str
    grand_total: float
    paid_amount: float
    due_amount: float
    items: List[PurchaseReturnableItem]


class DailyProductReturnBreakdown(BaseModel):
    date: str
    total_amount: float
    count: int


class ProductReturnReportSummaryData(BaseModel):
    total_returns_count: int
    total_returned_amount: float
    total_refund_received: float
    today_amount: float
    yesterday_amount: float
    this_week_amount: float
    this_month_amount: float
    daily_breakdown: List[DailyProductReturnBreakdown]
