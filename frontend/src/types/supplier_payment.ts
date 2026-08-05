import { SupplierItem } from "./supplier";
import { UserItem } from "./user";
import { PurchaseItem } from "./purchase";

export interface SupplierPaymentItem {
  id: string;
  payment_no: string;
  supplier_id: string;
  purchase_id?: string | null;
  user_id: string;
  amount: number;
  payment_method: string;
  reference_no?: string | null;
  payment_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  supplier?: SupplierItem;
  purchase?: Partial<PurchaseItem>;
  user?: Partial<UserItem>;
}

export interface SupplierPaymentCreatePayload {
  supplier_id: string;
  purchase_id?: string | null;
  amount: number;
  payment_method: string;
  reference_no?: string | null;
  payment_date?: string | null;
  notes?: string | null;
}

export interface SupplierPaymentUpdatePayload {
  amount?: number;
  payment_method?: string;
  reference_no?: string | null;
  payment_date?: string | null;
  notes?: string | null;
}

export interface SupplierFinancialSummary {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  phone: string;
  total_purchases: number;
  total_paid: number;
  current_due: number;
}

export interface DailySupplierPaymentBreakdown {
  date: string;
  total_amount: number;
  count: number;
}

export interface SupplierPaymentReportSummaryData {
  total_payments_count: number;
  total_paid_amount: number;
  today_amount: number;
  yesterday_amount: number;
  this_week_amount: number;
  this_month_amount: number;
  payment_method_breakdown: Record<string, number>;
  daily_breakdown: DailySupplierPaymentBreakdown[];
}
