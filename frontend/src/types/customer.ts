export interface CustomerItem {
  id: string;
  customer_code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  nid?: string;
  opening_balance: number;
  current_balance: number;
  credit_limit?: number;
  status: "active" | "inactive";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreatePayload {
  customer_code?: string;
  name: string;
  phone?: string;
  address?: string;
  opening_balance?: number;
  notes?: string;
}

export interface CustomerUpdatePayload {
  name?: string;
  phone?: string;
  address?: string;
  status?: string;
  notes?: string;
}

export interface CustomerLedgerTransaction {
  id: string;
  date: string;
  voucher_no: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  reference_id?: string;
  reference_type?: "sale" | "collection" | "sale_return" | "balance_adjustment";
}

export interface CustomerLedgerSummary {
  opening_balance: number;
  total_sales: number;
  total_collections: number;
  total_returns: number;
  manual_adjustments: number;
  current_due: number;
}

export interface CustomerLedgerResponse {
  customer: CustomerItem;
  summary: CustomerLedgerSummary;
  transactions: CustomerLedgerTransaction[];
}

