export interface CashBookItem {
  id: string;
  date: string;
  formatted_date: string;
  formatted_time: string;
  description: string;
  code: string;
  name: string;
  invoice: string;
  transaction_type:
    | "opening_balance"
    | "cash_sale"
    | "collection"
    | "expense"
    | "cash_out";
  debit: number;
  credit: number;
  balance: number;
}

export interface CashBookSummary {
  date: string;
  start_date: string;
  end_date: string;
  timezone: string;
  currency_symbol: string;
  previous_balance: number;
  today_cash_received: number;
  today_cash_expense: number;
  total_expense?: number;
  today_cash_out?: number;
  total_cash_out?: number;
  total_purchase_paid?: number;
  total_supplier_paid?: number;
  total_refund_paid?: number;
  cash_in_hand: number;
  total_cash_received: number;
  total_cash_paid: number;
  closing_cash_balance: number;
  company_name?: string | null;
  company_address?: string | null;
  company_phone?: string | null;
  company_logo?: string | null;
  items: CashBookItem[];
  supplier_summary?: SupplierPrintSummary | null;
  tracked_customer_name?: string | null;
  stock_summary?: CashBookStockItem[];
}

export interface CashBookStockItem {
  product_id: string;
  product_name: string;
  unit?: string;
  previous_stock: number;
  purchases: number;
  cash_sales?: number;
  due_sales?: number;
  regular_sales?: number;
  tracked_customer_sales?: number;
  sales: number;
  closing_stock: number;
}

export interface SupplierDailyAccount {
  date: string;
  previous_due: number;
  purchase_amount: number;
  return_amount: number;
  payment_amount: number;
  closing_due: number;
}

export interface SupplierPrintSummary {
  supplier_id: string;
  supplier_name: string;
  previous_due: number;
  purchase_amount: number;
  return_amount: number;
  payment_amount: number;
  closing_due: number;
  daily_accounts: SupplierDailyAccount[];
}
