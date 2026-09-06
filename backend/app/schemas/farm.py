from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.farm_transaction import FarmTransactionType


class FarmProductionCreate(BaseModel):
    product_id: str
    transaction_date: date
    tray_count: Optional[float] = Field(None, ge=0)
    units_per_tray: Optional[float] = Field(None, ge=0)
    quantity: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def compute_and_validate_quantity(self):
        if self.tray_count and self.units_per_tray and self.tray_count > 0 and self.units_per_tray > 0:
            if not self.quantity or self.quantity <= 0:
                self.quantity = float(self.tray_count * self.units_per_tray)
        if not self.quantity or self.quantity <= 0:
            raise ValueError("Quantity must be greater than 0 (or specify valid tray count and units per tray)")
        return self


class FarmDeliveryCreate(BaseModel):
    product_id: str
    transaction_date: date
    tray_count: Optional[float] = Field(None, ge=0)
    units_per_tray: Optional[float] = Field(None, ge=0)
    quantity: Optional[float] = Field(None, ge=0)
    destination: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def compute_and_validate_quantity(self):
        if self.tray_count and self.units_per_tray and self.tray_count > 0 and self.units_per_tray > 0:
            if not self.quantity or self.quantity <= 0:
                self.quantity = float(self.tray_count * self.units_per_tray)
        if not self.quantity or self.quantity <= 0:
            raise ValueError("Quantity must be greater than 0 (or specify valid tray count and units per tray)")
        return self


class FarmWasteCreate(BaseModel):
    product_id: str
    transaction_date: date
    quantity: float = Field(..., gt=0, description="Wasted quantity must be greater than 0")
    reason: Optional[str] = None
    notes: Optional[str] = None


class FarmTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    transaction_type: FarmTransactionType
    transaction_date: date
    tray_count: Optional[float] = None
    units_per_tray: Optional[float] = None
    quantity: float
    destination: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    unit: Optional[str] = None


class FarmDashboardKPIs(BaseModel):
    today_production: float
    today_trays: float
    today_delivered: float
    today_waste: float
    current_farm_stock: float


class FarmStockItem(BaseModel):
    product_id: str
    product_code: str
    name: str
    unit: str
    opening_stock: float
    total_production: float
    total_delivery: float
    total_waste: float
    current_stock: float


class FarmReportRow(BaseModel):
    date: date
    product_id: str
    product_name: str
    production: float
    delivery: float
    waste: float
    remaining_quantity: float


class FarmReportResponse(BaseModel):
    items: List[FarmReportRow]
    total_production: float
    total_delivery: float
    total_waste: float
    total_remaining: float
