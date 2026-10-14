from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ConfiguredCustomerInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    customer_code: Optional[str] = None


class StockMovementItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: datetime
    type: str  # "purchase", "sale", "purchase_return", "sale_return"
    type_label: str
    reference_no: str
    party_name: Optional[str] = None
    in_out: str  # "IN" | "OUT"
    quantity: float
    unit_price: float = 0.0
    total_price: float = 0.0
    cash_quantity: float = 0.0
    due_quantity: float = 0.0
    payment_status: Optional[str] = None
    running_stock: float


class StockReportProductInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_code: str
    unit: str
    category: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    selling_price: float = 0.0
    current_stock: float = 0.0


class DailyStockReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: StockReportProductInfo
    target_date: str
    timezone: str

    opening_stock: float
    previous_stock: float = 0.0
    purchases: float
    sales: float
    cash_sales: float
    due_sales: float
    customer_sales: float = 0.0
    configured_customer: Optional[ConfiguredCustomerInfo] = None
    purchase_returns: float
    sale_returns: float
    remaining_stock: float

    movements: List[StockMovementItem] = Field(default_factory=list)


# Cash Report Schemas

class CashSaleReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_no: str
    sale_date: datetime
    customer_id: str
    customer_name: str
    customer_code: Optional[str] = None
    grand_total: float
    paid_amount: float
    due_amount: float
    payment_status: str
    notes: Optional[str] = None


class CustomerCollectionReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    collection_no: str
    collection_date: datetime
    customer_id: str
    customer_name: str
    customer_code: Optional[str] = None
    amount: float
    payment_method: str
    reference_no: Optional[str] = None
    notes: Optional[str] = None


class CashOutReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cash_out_no: str
    cash_out_date: datetime
    amount: float
    reason: str
    category: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    status: str = "completed"


class CashOutReasonBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reason: str
    count: int
    total_amount: float
    percentage: float = 0.0


class CashOutReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_cash_outs: int = 0
    total_amount: float = 0.0
    average_amount: float = 0.0
    top_reason: Optional[str] = None
    top_reason_amount: float = 0.0


class CashOutReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    start_date: str
    end_date: str
    timezone: str
    summary: CashOutReportSummary
    reasons_breakdown: List[CashOutReasonBreakdown] = Field(default_factory=list)
    items: List[CashOutReportItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 1
    page_size: int = 50
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None


class ExpenseReportItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    voucher_no: str
    expense_date: datetime
    category_id: str
    category_name: str
    amount: float
    payment_method: str
    reference_no: Optional[str] = None
    description: Optional[str] = None
    created_by_name: Optional[str] = None


class CashReportBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cash_sales: List[CashSaleReportItem] = Field(default_factory=list)
    customer_collections: List[CustomerCollectionReportItem] = Field(default_factory=list)
    cash_outs: List[CashOutReportItem] = Field(default_factory=list)
    expenses: List[ExpenseReportItem] = Field(default_factory=list)


class DailyCashReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_date: str
    start_date: str
    end_date: str
    timezone: str

    # Cash Inflow (মোট প্রাপ্তি)
    cash_sales_amount: float = 0.0
    customer_collections_amount: float = 0.0
    total_cash_in: float = 0.0

    # Cash Outflow (মোট প্রদান)
    cash_out_amount: float = 0.0
    expenses_amount: float = 0.0
    total_cash_out: float = 0.0

    # Net Remaining Cash (অবশিষ্ট ব্যালেন্স)
    remaining_cash: float = 0.0

    # Business profile info for print / branding
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_logo: Optional[str] = None

    # Detailed Itemized Lists
    breakdown: CashReportBreakdown = Field(default_factory=CashReportBreakdown)

