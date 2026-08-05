from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Product Name")
    unit: str = Field(..., min_length=1, max_length=30, description="Measurement unit e.g. pcs, kg, box")
    purchase_price: float = Field(..., ge=0.0, description="Default purchase price ($)")
    selling_price: float = Field(..., ge=0.0, description="Default selling price ($)")
    product_code: Optional[str] = Field(None, max_length=50, description="Optional custom product code")
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    opening_stock: float = Field(0.0, ge=0.0, description="Initial stock level upon product creation")
    minimum_stock: float = Field(0.0, ge=0.0, description="Low stock alert threshold")
    notes: Optional[str] = None

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Product name cannot be empty")
        return v.strip()

    @field_validator("unit")
    def validate_unit(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Measurement unit cannot be empty")
        return v.strip()


class ProductUpdate(BaseModel):
    """
    Update Schema for Products.
    IMPORTANT: current_stock and opening_stock CANNOT be modified manually.
    Stock is maintained automatically through Purchases and Sales.
    """
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, min_length=1, max_length=30)
    purchase_price: Optional[float] = Field(None, ge=0.0)
    selling_price: Optional[float] = Field(None, ge=0.0)
    minimum_stock: Optional[float] = Field(None, ge=0.0)
    status: Optional[str] = Field(None, description="active / inactive")
    notes: Optional[str] = None


class ProductStatusUpdate(BaseModel):
    status: str = Field(..., description="active or inactive")


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_code: str
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    unit: str
    opening_stock: float
    current_stock: float
    purchase_price: float
    selling_price: float
    minimum_stock: float
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def available_stock(self) -> float:
        """Calculated available stock (current stock)."""
        return max(0.0, self.current_stock)

    @computed_field
    @property
    def is_low_stock(self) -> bool:
        """Returns True if current stock is at or below minimum stock alert."""
        return self.current_stock <= self.minimum_stock
