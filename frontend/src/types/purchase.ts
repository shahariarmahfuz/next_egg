import { ProductItem } from "./product";
import { SupplierItem } from "./supplier";

export interface PurchaseItemDetail {
  id: string;
  purchase_id: string;
  product_id: string;
  product?: ProductItem;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItemPayload {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface PurchaseItemRow {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
}

export interface PurchaseItem {
  id: string;
  purchase_no: string;
  invoice_no?: string;
  supplier_id: string;
  supplier?: SupplierItem;
  user_id: string;
  purchase_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
  notes?: string;
  items: PurchaseItemDetail[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseCreatePayload {
  supplier_id: string;
  purchase_no?: string;
  invoice_no?: string;
  purchase_date?: string;
  discount_amount: number;
  tax_amount: number;
  paid_amount: number;
  notes?: string;
  items: PurchaseItemPayload[];
}

export interface PurchaseUpdatePayload {
  supplier_id?: string;
  invoice_no?: string;
  purchase_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  paid_amount?: number;
  notes?: string;
  items?: PurchaseItemPayload[];
}

export interface PurchaseReportSummaryData {
  period: string;
  total_purchases: number;
  total_amount: number;
  total_paid: number;
  total_due: number;
  purchases: PurchaseItem[];
}
