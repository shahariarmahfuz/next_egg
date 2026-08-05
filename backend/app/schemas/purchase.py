from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.product import ProductResponse
from app.schemas.supplier import SupplierResponse


class PurchaseItemCreate(BaseModel):
    product_id: str = Field(..., description="Target product UUID")
    quantity: float = Field(..., gt=0.0, description="Purchase quantity")
    unit_price: float = Field(..., ge=0.0, description="Unit purchase price ($)")
    discount: float = Field(0.0, ge=0.0, description="Line item discount ($)")

    @field_validator("quantity")
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class PurchaseItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purchase_id: str
    product_id: str
    product: Optional[ProductResponse] = None
    quantity: float
    unit_price: float
    discount: float
    total_price: float
    created_at: datetime
    updated_at: datetime


class PurchaseCreate(BaseModel):
    supplier_id: str = Field(..., description="Supplier UUID")
    purchase_no: Optional[str] = Field(None, description="Optional custom PO code")
    invoice_no: Optional[str] = Field(None, description="Supplier Invoice Number")
    purchase_date: Optional[datetime] = None
    discount_amount: float = Field(0.0, ge=0.0)
    tax_amount: float = Field(0.0, ge=0.0)
    paid_amount: float = Field(0.0, ge=0.0)
    notes: Optional[str] = None
    items: List[PurchaseItemCreate] = Field(..., min_length=1, description="Purchase line items")

    @field_validator("items")
    def validate_items(cls, v: List[PurchaseItemCreate]) -> List[PurchaseItemCreate]:
        if not v:
            raise ValueError("Purchase must contain at least one product item")
        return v


class PurchaseUpdate(BaseModel):
    supplier_id: Optional[str] = None
    invoice_no: Optional[str] = None
    purchase_date: Optional[datetime] = None
    discount_amount: Optional[float] = Field(None, ge=0.0)
    tax_amount: Optional[float] = Field(None, ge=0.0)
    paid_amount: Optional[float] = Field(None, ge=0.0)
    notes: Optional[str] = None
    items: Optional[List[PurchaseItemCreate]] = Field(None, min_length=1)


class PurchaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purchase_no: str
    invoice_no: Optional[str] = None
    supplier_id: str
    supplier: Optional[SupplierResponse] = None
    user_id: str
    purchase_date: datetime
    subtotal: float
    discount_amount: float
    tax_amount: float
    grand_total: float
    paid_amount: float
    due_amount: float
    payment_status: str
    notes: Optional[str] = None
    items: List[PurchaseItemResponse] = []
    created_at: datetime
    updated_at: datetime


class PurchaseReportSummary(BaseModel):
    period: str
    total_purchases: int
    total_amount: float
    total_paid: float
    total_due: float
    purchases: List[PurchaseResponse] = []
