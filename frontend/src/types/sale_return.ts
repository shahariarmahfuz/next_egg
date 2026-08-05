import { CustomerItem } from "./customer";
import { ProductItem } from "./product";
import { UserItem } from "./user";
import { SaleItem } from "./sale";

export interface SaleReturnItemModel {
  id: string;
  sale_return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;

  product?: ProductItem;
}

export interface SaleReturnItem {
  id: string;
  return_no: string;
  sale_id?: string | null;
  customer_id: string;
  user_id: string;
  return_date: string;
  grand_total: number;
  refund_amount: number;
  reason?: string | null;
  created_at: string;
  updated_at: string;

  customer?: CustomerItem;
  sale?: Partial<SaleItem>;
  user?: Partial<UserItem>;
  items: SaleReturnItemModel[];
}

export interface SaleReturnItemCreatePayload {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface SaleReturnCreatePayload {
  sale_id?: string | null;
  customer_id: string;
  return_date?: string | null;
  refund_amount?: number;
  reason?: string | null;
  items: SaleReturnItemCreatePayload[];
}

export interface SaleReturnUpdatePayload {
  refund_amount?: number;
  reason?: string | null;
  items?: SaleReturnItemCreatePayload[];
}

export interface SaleReturnableItem {
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  sold_quantity: number;
  previously_returned_qty: number;
  returnable_qty: number;
  unit_price: number;
}

export interface SaleReturnableSummary {
  sale_id: string;
  invoice_no: string;
  sale_date: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_code: string;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  items: SaleReturnableItem[];
}

export interface DailyReturnBreakdown {
  date: string;
  total_amount: number;
  count: number;
}

export interface SaleReturnReportSummaryData {
  total_returns_count: number;
  total_returned_amount: number;
  total_refund_amount: number;
  today_amount: number;
  yesterday_amount: number;
  this_week_amount: number;
  this_month_amount: number;
  daily_breakdown: DailyReturnBreakdown[];
}
