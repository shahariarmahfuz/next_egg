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
