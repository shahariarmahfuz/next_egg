export interface ConfiguredCustomerInfo {
  id: string;
  name: string;
  customer_code?: string | null;
}

export interface StockMovementItem {
  id: string;
  timestamp: string;
  type: "purchase" | "sale" | "purchase_return" | "sale_return";
  type_label: string;
  reference_no: string;
  party_name?: string | null;
  in_out: "IN" | "OUT";
  quantity: number;
  unit_price: number;
  total_price: number;
  cash_quantity: number;
  due_quantity: number;
  payment_status?: string | null;
  running_stock: number;
}

export interface StockReportProductInfo {
  id: string;
  name: string;
  product_code: string;
  unit: string;
  category?: string | null;
  brand?: string | null;
  barcode?: string | null;
  selling_price: number;
  current_stock: number;
}

export interface DailyStockReportData {
  product: StockReportProductInfo;
  target_date: string;
  timezone: string;
  opening_stock: number;
  previous_stock?: number;
  purchases: number;
  sales: number;
  cash_sales: number;
  due_sales: number;
  customer_sales?: number;
  configured_customer?: ConfiguredCustomerInfo | null;
  purchase_returns: number;
  sale_returns: number;
  remaining_stock: number;
  movements?: StockMovementItem[];
}

export interface CashSaleReportItem {
  id: string;
  invoice_no: string;
  sale_date: string;
  customer_id: string;
  customer_name: string;
  customer_code?: string | null;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  notes?: string | null;
}

export interface CustomerCollectionReportItem {
  id: string;
  collection_no: string;
  collection_date: string;
  customer_id: string;
  customer_name: string;
  customer_code?: string | null;
  amount: number;
  payment_method: string;
  reference_no?: string | null;
  notes?: string | null;
}

export interface CashOutReportItem {
  id: string;
  cash_out_no: string;
  cash_out_date: string;
  amount: number;
  reason: string;
  notes?: string | null;
  created_by_name?: string | null;
}

export interface ExpenseReportItem {
  id: string;
  voucher_no: string;
  expense_date: string;
  category_id: string;
  category_name: string;
  amount: number;
  payment_method: string;
  reference_no?: string | null;
  description?: string | null;
  created_by_name?: string | null;
}

export interface CashReportBreakdown {
  cash_sales: CashSaleReportItem[];
  customer_collections: CustomerCollectionReportItem[];
  cash_outs: CashOutReportItem[];
  expenses: ExpenseReportItem[];
}

export interface DailyCashReportData {
  target_date: string;
  start_date: string;
  end_date: string;
  timezone: string;
  cash_sales_amount: number;
  customer_collections_amount: number;
  total_cash_in: number;
  cash_out_amount: number;
  expenses_amount: number;
  total_cash_out: number;
  remaining_cash: number;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_logo?: string | null;
  breakdown: CashReportBreakdown;
}

