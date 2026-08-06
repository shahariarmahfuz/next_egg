from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class CurrencyBase(BaseModel):
    name: str
    code: str
    symbol: str
    symbol_position: str = "before"
    decimal_places: int = 2
    is_default: bool = False
    status: str = "active"

class CurrencyCreate(CurrencyBase):
    pass

class CurrencyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    symbol: Optional[str] = None
    symbol_position: Optional[str] = None
    decimal_places: Optional[int] = None
    is_default: Optional[bool] = None
    status: Optional[str] = None

class CurrencyResponse(CurrencyBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
