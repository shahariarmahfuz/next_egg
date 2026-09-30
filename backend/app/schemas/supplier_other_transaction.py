from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.supplier import SupplierResponse
from app.schemas.user import UserResponse


class SupplierOtherTransactionBase(BaseModel):
    transaction_type: str = Field("other_payable", description="Transaction type, e.g. other_payable")
    amount: float = Field(..., gt=0.0, description="Transaction amount (must be positive)")
    transaction_date: Optional[datetime] = Field(None, description="Date and time of transaction")
    reference_no: Optional[str] = Field(None, max_length=100, description="External reference number")
    notes: Optional[str] = Field(None, description="Additional notes")


class SupplierOtherTransactionCreate(SupplierOtherTransactionBase):
    supplier_id: str = Field(..., description="Target Supplier UUID")


class SupplierOtherTransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0.0)
    transaction_date: Optional[datetime] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None


class SupplierOtherTransactionResponse(SupplierOtherTransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    voucher_no: str
    supplier_id: str
    user_id: str
    supplier: Optional[SupplierResponse] = None
    user: Optional[UserResponse] = None
    created_at: datetime
    updated_at: datetime
