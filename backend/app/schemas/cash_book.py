from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CashBookItem(BaseModel):
    """
    Individual Cash Ledger Transaction Item for Cash Book table.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: datetime
    formatted_date: str
    formatted_time: str
    description: str
    code: str = "—"
    name: str = "—"
    invoice: str = "—"
    transaction_type: str = Field(
        ...,
        description="Type: opening_balance, cash_sale, collection, expense",
    )
    debit: float = Field(0.0, description="Cash OUT")
    credit: float = Field(0.0, description="Cash IN")
    balance: float = Field(..., description="Running Cash in Hand after transaction")


class CashBookSummary(BaseModel):
    """
    Complete Cash Book Response Payload for a selected business date or range.
    """
    model_config = ConfigDict(from_attributes=True)

    date: str
    start_date: datetime
    end_date: datetime
    timezone: str
    currency_symbol: str
    
    # Financial KPI summary cards
    previous_balance: float = Field(..., description="Opening cash before this date")
    today_cash_received: float = Field(..., description="Cash inflows during period")
    today_cash_expense: float = Field(..., description="Actual cash expenses during period (Expense module only)")
    total_expense: float = Field(0.0, description="Actual cash expenses during period (Expense module only)")
    total_purchase_paid: float = Field(0.0, description="Cash paid on purchases during period")
    total_supplier_paid: float = Field(0.0, description="Cash paid to suppliers during period")
    total_refund_paid: float = Field(0.0, description="Cash refunded on returns during period")
    cash_in_hand: float = Field(..., description="Closing cash in hand = previous + received - total_paid")
    
    total_cash_received: float = Field(..., description="Total cash received in period")
    total_cash_paid: float = Field(..., description="Total cash paid in period (all outflows)")
    closing_cash_balance: float = Field(..., description="Closing cash balance")

    # Business profile info for print / branding
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_logo: Optional[str] = None

    items: List[CashBookItem] = Field(default_factory=list)
