export interface FarmItem {
  id: string;
  name: string;
  code: string;
  previous_tray: number;
  address?: string | null;
  contact_number?: string | null;
  email?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmBalanceItem {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  contact_number?: string | null;
  email?: string | null;
  status: string;
  notes?: string | null;
  previous_tray: number;
  total_production: number;
  total_delivered: number;
  available_tray: number;
  created_at: string;
  updated_at: string;
}

export interface FarmPayload {
  name: string;
  code?: string;
  previous_tray?: number;
  address?: string;
  contact_number?: string;
  email?: string;
  status?: string;
  notes?: string;
}

export interface DeliveryItem {
  id?: string;
  entry_id?: string;
  destination: string;
  tray_quantity: number;
  notes?: string | null;
}

export interface FarmDailyEntryItem {
  id: string;
  farm_id: string;
  farm_name?: string | null;
  farm_code?: string | null;
  date: string;
  production_trays: number;
  deliveries: DeliveryItem[];
  total_delivery_trays: number;
  net_trays: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmDailyEntryCreatePayload {
  farm_id: string;
  date: string;
  production_trays?: number;
  deliveries: {
    destination: string;
    tray_quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

export interface FarmDailyEntryUpdatePayload {
  farm_id?: string;
  date?: string;
  production_trays?: number;
  deliveries?: {
    destination: string;
    tray_quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

export interface FarmProductionItem {
  id: string;
  farm_id: string;
  farm_name?: string | null;
  farm_code?: string | null;
  production_date: string;
  tray_quantity: number;
  notes?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmProductionCreatePayload {
  farm_id: string;
  production_date: string;
  tray_quantity: number;
  notes?: string;
}

export interface FarmProductionUpdatePayload {
  farm_id?: string;
  production_date?: string;
  tray_quantity?: number;
  notes?: string;
}

export interface DeliveryEntry {
  destination: string;
  tray_quantity: number;
  notes?: string;
}

export interface FarmDeliveryItem {
  id: string;
  farm_id: string;
  farm_name?: string | null;
  farm_code?: string | null;
  delivery_date: string;
  destination: string;
  tray_quantity: number;
  notes?: string | null;
  batch_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmDeliveryCreatePayload {
  farm_id: string;
  delivery_date: string;
  destination: string;
  tray_quantity: number;
  notes?: string;
}

export interface FarmDeliveryBatchPayload {
  farm_id: string;
  delivery_date: string;
  entries: DeliveryEntry[];
}

export interface FarmDeliveryUpdatePayload {
  farm_id?: string;
  delivery_date?: string;
  destination?: string;
  tray_quantity?: number;
  notes?: string;
}

export interface DestinationBreakdown {
  destination: string;
  trays: number;
  notes?: string | null;
}

export interface FarmReportItem {
  date: string;
  farm_id: string;
  farm_name: string;
  farm_code: string;
  production_trays: number;
  delivery_trays: number;
  deliveries: DestinationBreakdown[];
  available_tray?: number;
}

export interface FarmReportKPIs {
  total_previous_trays: number;
  total_production: number;
  total_delivered: number;
  total_available_trays: number;
}

export interface FarmReportResponse {
  kpis: FarmReportKPIs;
  items: FarmReportItem[];
}
