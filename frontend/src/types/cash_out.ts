export interface CashOutItem {
  id: string;
  cash_out_no: string;
  amount: number;
  cash_out_date: string;
  reason: string;
  notes?: string | null;
  note?: string | null;
  created_by_id: string;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashOutInput {
  amount: number;
  cash_out_date: string;
  reason: string;
  notes?: string;
  note?: string;
}
