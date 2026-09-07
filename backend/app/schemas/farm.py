from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# --- Farm Entity Schemas ---
class FarmBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None


class FarmCreate(FarmBase):
    previous_tray: Optional[float] = Field(0.0, ge=0)


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    code: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    previous_tray: Optional[float] = Field(None, ge=0)


class PreviousTrayUpdate(BaseModel):
    previous_tray: float = Field(..., ge=0, description="Opening tray quantity balance")


class FarmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    previous_tray: float
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FarmBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    address: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    status: str
    notes: Optional[str] = None
    previous_tray: float
    total_production: float
    total_delivered: float
    available_tray: float
    created_at: datetime
    updated_at: datetime


# --- Unified Farm Daily / Transaction Entry Schemas ---
class DeliveryItemCreate(BaseModel):
    id: Optional[str] = None
    destination: str = Field(..., min_length=1, max_length=200, description="Destination name (e.g. Shop, Karim)")
    tray_quantity: float = Field(..., gt=0, description="Quantity of trays dispatched")
    notes: Optional[str] = None


class DeliveryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_id: Optional[str] = None
    destination: str
    tray_quantity: float
    notes: Optional[str] = None


class FarmDailyEntryCreate(BaseModel):
    farm_id: str
    date: date
    production_trays: float = Field(0.0, ge=0, description="Harvested production in trays (optional, 0 if none)")
    deliveries: List[DeliveryItemCreate] = Field(default_factory=list, description="List of deliveries on this date")
    notes: Optional[str] = None


class FarmDailyEntryUpdate(BaseModel):
    farm_id: Optional[str] = None
    date: Optional[date] = None
    production_trays: Optional[float] = Field(None, ge=0)
    deliveries: Optional[List[DeliveryItemCreate]] = None
    notes: Optional[str] = None


class FarmDailyEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    date: date
    production_trays: float
    deliveries: List[DeliveryItemResponse]
    total_delivery_trays: float
    net_trays: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- Legacy / Direct Production & Delivery Schemas ---
class FarmProductionCreate(BaseModel):
    farm_id: str
    production_date: date
    tray_quantity: float = Field(..., gt=0, description="Production quantity in trays")
    notes: Optional[str] = None


class FarmProductionUpdate(BaseModel):
    farm_id: Optional[str] = None
    production_date: Optional[date] = None
    tray_quantity: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class FarmProductionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    production_date: date
    tray_quantity: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FarmDeliveryCreate(BaseModel):
    farm_id: str
    delivery_date: date
    destination: str = Field(..., min_length=1, max_length=200, description="Store or destination name (e.g. Shop, Ayonal)")
    tray_quantity: float = Field(..., gt=0, description="Quantity of trays delivered")
    notes: Optional[str] = None


class DeliveryEntryItem(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200, description="Delivery destination or name")
    tray_quantity: float = Field(..., gt=0, description="Quantity of trays delivered")
    notes: Optional[str] = None


class FarmDeliveryBatchCreate(BaseModel):
    farm_id: str
    delivery_date: date
    entries: List[DeliveryEntryItem] = Field(..., min_length=1, description="Multi-entry delivery destinations")


class FarmDeliveryUpdate(BaseModel):
    farm_id: Optional[str] = None
    delivery_date: Optional[date] = None
    destination: Optional[str] = Field(None, min_length=1, max_length=200)
    tray_quantity: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class FarmDeliveryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    farm_name: Optional[str] = None
    farm_code: Optional[str] = None
    delivery_date: date
    destination: str
    tray_quantity: float
    notes: Optional[str] = None
    batch_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- Farm Report Schemas ---
class DestinationBreakdown(BaseModel):
    destination: str
    trays: float
    notes: Optional[str] = None


class FarmReportItem(BaseModel):
    date: date
    farm_id: str
    farm_name: str
    farm_code: str
    production_trays: float
    delivery_trays: float
    deliveries: List[DestinationBreakdown]
    available_tray: Optional[float] = None


class FarmReportKPIs(BaseModel):
    total_previous_trays: float
    total_production: float
    total_delivered: float
    total_available_trays: float


class FarmReportResponse(BaseModel):
    kpis: FarmReportKPIs
    items: List[FarmReportItem]


# --- Farm Ledger Schemas ---
class FarmLedgerItem(BaseModel):
    id: Optional[str] = None
    date: str
    type: str  # 'opening', 'production', 'delivery'
    description: str
    production: Optional[float] = None
    delivery: Optional[float] = None
    balance: float
    notes: Optional[str] = None


class FarmLedgerResponse(BaseModel):
    farm_id: str
    farm_name: str
    farm_code: Optional[str] = None
    opening_balance: float
    closing_balance: float
    total_production: float
    total_delivery: float
    items: List[FarmLedgerItem]
