export interface DashboardCardsSummary {
  total_products: number;
  total_customers: number;
  total_sales: number;
  total_cash_sales: number;
  total_due_sales: number;
  total_purchases: number;
  total_expenses: number;
  customer_due: number;
  supplier_due: number;
  total_profit: number;
}

export interface RecentSaleItem {
  id: string;
  invoice_no: string;
  customer_name: string;
  grand_total: number;
  sale_date: string;
}

export interface LowStockProductItem {
  id: string;
  product_code: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
}
