from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ConfiguredCustomerInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    customer_code: Optional[str] = None


class StockMovementItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: datetime
    type: str  # "purchase", "sale", "purchase_return", "sale_return"
    type_label: str
    reference_no: str
    party_name: Optional[str] = None
    in_out: str  # "IN" | "OUT"
    quantity: float
    unit_price: float = 0.0
    total_price: float = 0.0
    cash_quantity: float = 0.0
    due_quantity: float = 0.0
    payment_status: Optional[str] = None
    running_stock: float


class StockReportProductInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_code: str
    unit: str
    category: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    selling_price: float = 0.0
    current_stock: float = 0.0


class DailyStockReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: StockReportProductInfo
    target_date: str
    timezone: str

    opening_stock: float
    purchases: float
    sales: float
    cash_sales: float
    due_sales: float
    customer_sales: float = 0.0
    configured_customer: Optional[ConfiguredCustomerInfo] = None
    purchase_returns: float
    sale_returns: float
    remaining_stock: float

    movements: List[StockMovementItem] = Field(default_factory=list)
