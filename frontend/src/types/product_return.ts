import { ProductItem } from "./product";
import { SupplierItem } from "./supplier";
import { UserItem } from "./user";
import { PurchaseItem as PurchaseModelItem } from "./purchase";

export interface ProductReturnItemModel {
  id: string;
  product_return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;

  product?: ProductItem;
}

export interface ProductReturnItem {
  id: string;
  return_no: string;
  purchase_id?: string | null;
  supplier_id: string;
  user_id: string;
  return_date: string;
  grand_total: number;
  refund_received: number;
  reason?: string | null;
  created_at: string;
  updated_at: string;

  supplier?: SupplierItem;
  purchase?: Partial<PurchaseModelItem>;
  user?: Partial<UserItem>;
  items: ProductReturnItemModel[];
}

export interface ProductReturnItemCreatePayload {
  product_id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface ProductReturnCreatePayload {
  purchase_id?: string | null;
  supplier_id: string;
  return_date?: string | null;
  refund_received?: number;
  reason?: string | null;
  items: ProductReturnItemCreatePayload[];
}

export interface ProductReturnUpdatePayload {
  refund_received?: number;
  reason?: string | null;
  items?: ProductReturnItemCreatePayload[];
}

export interface PurchaseReturnableItem {
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  purchased_quantity: number;
  previously_returned_qty: number;
  returnable_qty: number;
  unit_price: number;
}

export interface PurchaseReturnableSummary {
  purchase_id: string;
  purchase_no: string;
  invoice_no?: string | null;
  purchase_date: string;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_code: string;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  items: PurchaseReturnableItem[];
}

export interface DailyProductReturnBreakdown {
  date: string;
  total_amount: number;
  count: number;
}

export interface ProductReturnReportSummaryData {
  total_returns_count: number;
  total_returned_amount: number;
  total_refund_received: number;
  today_amount: number;
  yesterday_amount: number;
  this_week_amount: number;
  this_month_amount: number;
  daily_breakdown: DailyProductReturnBreakdown[];
}
