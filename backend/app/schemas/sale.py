from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.customer import CustomerResponse
from app.schemas.product import ProductResponse


class SaleItemCreate(BaseModel):
    product_id: str = Field(..., description="Target Product UUID")
    quantity: float = Field(..., gt=0.0, description="Quantity sold (> 0)")
    unit_price: float = Field(..., ge=0.0, description="Unit selling price ($)")
    discount: float = Field(0.0, ge=0.0, description="Per-item discount ($)")

    @field_validator("quantity")
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Sale line item quantity must be greater than zero")
        return v


class SaleItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sale_id: str
    product_id: str
    quantity: float
    unit_price: float
    discount: float
    total_price: float
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None


class SaleCreate(BaseModel):
    customer_id: str = Field(..., description="Target Customer UUID")
    invoice_no: Optional[str] = Field(None, max_length=50, description="Optional custom sale invoice number")
    sale_date: Optional[datetime] = Field(None, description="Sale Transaction Date (Defaults to now)")
    discount_amount: float = Field(0.0, ge=0.0, description="Overall order discount ($)")
    tax_amount: float = Field(0.0, ge=0.0, description="Overall order tax ($)")
    paid_amount: float = Field(0.0, ge=0.0, description="Amount paid by customer ($)")
    notes: Optional[str] = None
    items: List[SaleItemCreate] = Field(..., min_length=1, description="List of products sold")

    @field_validator("items")
    def validate_items(cls, v: List[SaleItemCreate]) -> List[SaleItemCreate]:
        if not v or len(v) == 0:
            raise ValueError("Sale invoice must contain at least one line item")
        return v


class SaleUpdate(BaseModel):
    customer_id: Optional[str] = None
    sale_date: Optional[datetime] = None
    discount_amount: Optional[float] = Field(None, ge=0.0)
    tax_amount: Optional[float] = Field(None, ge=0.0)
    paid_amount: Optional[float] = Field(None, ge=0.0)
    notes: Optional[str] = None
    items: Optional[List[SaleItemCreate]] = Field(None, min_length=1)


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_no: str
    customer_id: str
    user_id: str
    sale_date: datetime
    subtotal: float
    discount_amount: float
    tax_amount: float
    grand_total: float
    paid_amount: float
    due_amount: float
    payment_status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerResponse] = None
    items: List[SaleItemResponse] = []


class SaleReportSummary(BaseModel):
    total_sales: int = Field(..., description="Total Sales Invoice Count")
    total_sale_amount: float = Field(..., description="Total Grand Total Revenue ($)")
    total_discount: float = Field(..., description="Total Order Discount ($)")
    total_paid: float = Field(..., description="Total Amount Collected ($)")
    total_due: float = Field(..., description="Total Outstanding Due ($)")
    total_items_sold: float = Field(..., description="Total Line Items Sold Quantity")
