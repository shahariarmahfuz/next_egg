from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Supplier Name")
    phone: Optional[str] = Field(None, max_length=30, description="Contact Phone Number")
    address: Optional[str] = Field(None, description="Physical Address")
    status: str = Field("active", description="Supplier status: active, inactive")
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    supplier_code: Optional[str] = Field(None, description="Optional custom supplier code")
    opening_balance: float = Field(0.0, ge=0.0, description="Opening Due Amount ($)")


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    current_balance: Optional[float] = Field(None, ge=0.0, description="Updated Due Balance ($)")
    status: Optional[str] = None
    notes: Optional[str] = None


class SupplierStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: active, inactive")


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    supplier_code: str
    company_name: Optional[str] = None
    email: Optional[str] = None
    nid: Optional[str] = None
    opening_balance: float
    current_balance: float
    created_at: datetime
    updated_at: datetime
