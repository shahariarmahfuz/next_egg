export type FarmTransactionType = "PRODUCTION" | "DELIVERY" | "WASTE";

export interface FarmTransactionItem {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  unit?: string;
  transaction_type: FarmTransactionType;
  transaction_date: string;
  tray_count?: number | null;
  units_per_tray?: number | null;
  quantity: number;
  destination?: string | null;
  notes?: string | null;
  note?: string | null;
  created_at: string;
}

export interface FarmStockItem {
  product_id: string;
  product_code: string;
  name: string;
  unit: string;
  opening_stock: number;
  total_production: number;
  total_delivery: number;
  total_waste: number;
  current_stock: number;
}

export interface FarmDashboardKPIs {
  today_production: number;
  today_trays: number;
  today_delivered: number;
  today_waste: number;
  current_farm_stock: number;
}

export interface FarmReportRow {
  date: string;
  product_id: string;
  product_name: string;
  production: number;
  delivery: number;
  waste: number;
  remaining_quantity: number;
}

export interface FarmReportResponse {
  items: FarmReportRow[];
  total_production: number;
  total_delivery: number;
  total_waste: number;
  total_remaining: number;
}

export interface FarmProductionPayload {
  product_id: string;
  transaction_date: string;
  tray_count?: number;
  units_per_tray?: number;
  quantity?: number;
  notes?: string;
  note?: string;
}

export interface FarmDeliveryPayload {
  product_id: string;
  transaction_date: string;
  tray_count?: number;
  units_per_tray?: number;
  quantity?: number;
  destination?: string;
  vehicle_number?: string;
  driver_name?: string;
  notes?: string;
  note?: string;
}

export interface FarmWastePayload {
  product_id: string;
  transaction_date: string;
  quantity: number;
  reason?: string;
  notes?: string;
  note?: string;
}
