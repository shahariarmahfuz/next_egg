export interface SupplierItem {
  id: string;
  supplier_code: string;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  nid?: string;
  opening_balance: number;
  current_balance: number;
  status: "active" | "inactive";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreatePayload {
  supplier_code?: string;
  name: string;
  phone?: string;
  address?: string;
  opening_balance?: number;
  status?: string;
  notes?: string;
}

export interface SupplierUpdatePayload {
  name?: string;
  phone?: string;
  address?: string;
  current_balance?: number;
  status?: string;
  notes?: string;
}

export interface SupplierLedgerTransaction {
  id: string;
  date: string;
  voucher_no: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  reference_id?: string;
  reference_type?: "purchase" | "supplier_payment" | "product_return" | "balance_adjustment";
}

export interface SupplierLedgerSummary {
  opening_balance: number;
  total_purchases: number;
  total_payments: number;
  total_returns: number;
  manual_adjustments: number;
  current_due: number;
}

export interface SupplierLedgerResponse {
  supplier: SupplierItem;
  summary: SupplierLedgerSummary;
  transactions: SupplierLedgerTransaction[];
}

