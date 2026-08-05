from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DashboardCardsSummary(BaseModel):
    total_products: int
    total_customers: int
    total_sales: float
    total_cash_sales: float
    total_due_sales: float
    total_purchases: float
    total_expenses: float
    customer_due: float
    supplier_due: float
    total_profit: float


class RecentSaleItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_no: str
    customer_name: str
    grand_total: float
    sale_date: datetime


class LowStockProductItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_code: str
    name: str
    unit: str
    current_stock: float
    minimum_stock: float


class DashboardDataResponse(BaseModel):
    summary: DashboardCardsSummary
    recent_sales: List[RecentSaleItem]
    low_stock_products: List[LowStockProductItem]
