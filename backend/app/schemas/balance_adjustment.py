from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BalanceAdjustmentCreate(BaseModel):
    new_balance: float = Field(..., description="Target new current balance")
    balance_type: str = Field(..., description="customer_due, customer_advance, supplier_payable, supplier_advance")
    effective_date: Optional[datetime] = None
    reason: str = Field(..., min_length=2, max_length=150, description="Reason for adjustment")
    notes: Optional[str] = None


class BalanceAdjustmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entity_type: str
    entity_id: str
    previous_balance: float
    new_balance: float
    difference: float
    balance_type: str
    effective_date: datetime
    reason: str
    notes: Optional[str] = None
    created_by_user_id: str
    created_by_user_name: str
    created_at: datetime
