from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class StackRowSchema(BaseModel):
    id: str = Field(..., max_length=64)
    traysPerStack: Union[int, float, str] = ""
    stacksCount: Union[int, float, str] = ""


class LooseEntriesSchema(BaseModel):
    good: List[int] = Field(default_factory=list)
    cracked: List[int] = Field(default_factory=list)
    broken: List[int] = Field(default_factory=list)
    spoiled: List[int] = Field(default_factory=list)


class CalculatorHistoryCreate(BaseModel):
    calculator_type: str = Field(default="egg", min_length=1, max_length=50)
    calculation_date: Optional[datetime] = None
    product_id: Optional[str] = Field(default=None, max_length=36)
    product_name: Optional[str] = Field(default=None, max_length=150)
    system_stock: Optional[int] = None
    eggs_per_tray: int = Field(default=30, ge=1, le=500)
    stacks: List[StackRowSchema] = Field(default_factory=list)
    loose_entries: LooseEntriesSchema = Field(default_factory=LooseEntriesSchema)
    next_day_sell: int = Field(default=0, ge=0)
    total_trays: int = Field(default=0, ge=0)
    total_tray_eggs: int = Field(default=0, ge=0)
    total_loose_eggs: int = Field(default=0, ge=0)
    next_day_sell_eggs: int = Field(default=0, ge=0)
    grand_total_eggs: int = Field(default=0, ge=0)
    full_trays: int = Field(default=0, ge=0)
    remainder_eggs: int = Field(default=0, ge=0)
    stock_difference: Optional[int] = None
    notes: Optional[str] = None


class CalculatorHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    calculator_type: str
    calculation_date: datetime
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    system_stock: Optional[int] = None
    eggs_per_tray: int
    stacks: List[Dict[str, Any]]
    loose_entries: Dict[str, List[int]]
    next_day_sell: int
    total_trays: int
    total_tray_eggs: int
    total_loose_eggs: int
    next_day_sell_eggs: int
    grand_total_eggs: int
    full_trays: int
    remainder_eggs: int
    stock_difference: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
