import { CustomerItem } from "./customer";
import { ProductItem } from "./product";

export interface SaleItemLine {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  created_at: string;
  updated_at: string;
  product?: ProductItem;
}

export interface SaleItem {
  id: string;
  invoice_no: string;
  customer_id: string;
  user_id: string;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: CustomerItem;
  items: SaleItemLine[];
}

export interface SaleItemCreatePayload {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface SaleCreatePayload {
  customer_id: string;
  invoice_no?: string;
  sale_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  paid_amount?: number;
  notes?: string;
  items: SaleItemCreatePayload[];
}

export interface SaleUpdatePayload {
  customer_id?: string;
  sale_date?: string;
  discount_amount?: number;
  tax_amount?: number;
  paid_amount?: number;
  notes?: string;
  items?: SaleItemCreatePayload[];
}

export interface SaleReportSummaryData {
  total_sales: number;
  total_sale_amount: number;
  total_discount: number;
  total_paid: number;
  total_due: number;
  total_items_sold: number;
  total_revenue?: number;
  sales_count?: number;
}
