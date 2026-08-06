from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.schemas.currency import CurrencyResponse

class SettingBase(BaseModel):
    key: str
    value: str
    group_name: str = "general"
    description: Optional[str] = None

class SettingCreate(SettingBase):
    pass

class SettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None

class SettingResponse(SettingBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

class BusinessSettingsResponse(BaseModel):
    business_name: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    week_start: Optional[str] = None
    language: Optional[str] = None
    thousand_separator: Optional[str] = None
    decimal_separator: Optional[str] = None
    currency: Optional[CurrencyResponse] = None

class BusinessSettingsUpdate(BaseModel):
    business_name: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    week_start: Optional[str] = None
    language: Optional[str] = None
    thousand_separator: Optional[str] = None
    decimal_separator: Optional[str] = None
    default_currency_id: Optional[str] = None
