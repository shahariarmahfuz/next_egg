import { CustomerItem } from "./customer";
import { UserItem } from "./user";

export interface SaleNestedItem {
  id: string;
  invoice_no: string;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
}

export interface CustomerCollectionItem {
  id: string;
  collection_no: string;
  customer_id: string;
  sale_id?: string | null;
  user_id: string;
  amount: number;
  payment_method: string;
  reference_no?: string | null;
  collection_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  customer?: CustomerItem;
  user?: Partial<UserItem>;
  sale?: SaleNestedItem;
}

export interface CustomerCollectionCreatePayload {
  customer_id: string;
  amount: number;
  payment_method: string;
  collection_date?: string | null;
  reference_no?: string | null;
  sale_id?: string | null;
  notes?: string | null;
}

export interface CustomerCollectionUpdatePayload {
  amount?: number;
  payment_method?: string;
  collection_date?: string | null;
  reference_no?: string | null;
  sale_id?: string | null;
  notes?: string | null;
}

export interface CustomerFinancialSummary {
  customer_id: string;
  customer_code: string;
  name: string;
  phone: string;
  current_due: number;
  total_sales: number;
  total_paid: number;
  remaining_due: number;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  total_amount: number;
  count: number;
}

export interface DailyCollectionBreakdown {
  date: string;
  total_amount: number;
  count: number;
}

export interface CollectionReportSummaryData {
  total_collections_count: number;
  total_collected_amount: number;
  today_amount: number;
  yesterday_amount: number;
  this_week_amount: number;
  this_month_amount: number;
  payment_method_breakdown: PaymentMethodBreakdown[];
  daily_breakdown: DailyCollectionBreakdown[];
}
