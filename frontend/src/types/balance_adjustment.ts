export interface BalanceAdjustmentPayload {
  new_balance: number;
  balance_type: string;
  effective_date?: string;
  reason: string;
  notes?: string;
}

export interface BalanceAdjustmentItem {
  id: string;
  entity_type: "customer" | "supplier";
  entity_id: string;
  previous_balance: number;
  new_balance: number;
  difference: number;
  balance_type: string;
  effective_date: string;
  reason: string;
  notes?: string;
  created_by_user_id: string;
  created_by_user_name: string;
  created_at: string;
}
