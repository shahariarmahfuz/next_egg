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
    | "expense";
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
}
