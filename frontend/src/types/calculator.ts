export type CalculatorLooseCategoryKey = "good" | "cracked" | "broken" | "spoiled";

export interface CalculatorStackRow {
  id: string;
  traysPerStack: number | "";
  stacksCount: number | "";
}

export type CalculatorLooseEntries = Record<CalculatorLooseCategoryKey, number[]>;

export interface CalculatorHistoryItem {
  id: string;
  user_id: string;
  calculator_type: string;
  calculation_date: string;
  product_id?: string | null;
  product_name?: string | null;
  system_stock?: number | null;
  eggs_per_tray: number;
  stacks: CalculatorStackRow[];
  loose_entries: CalculatorLooseEntries;
  next_day_sell: number;
  total_trays: number;
  total_tray_eggs: number;
  total_loose_eggs: number;
  next_day_sell_eggs: number;
  grand_total_eggs: number;
  full_trays: number;
  remainder_eggs: number;
  stock_difference?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalculatorHistoryCreatePayload {
  calculator_type?: string;
  calculation_date?: string;
  product_id?: string | null;
  product_name?: string | null;
  system_stock?: number | null;
  eggs_per_tray: number;
  stacks: CalculatorStackRow[];
  loose_entries: CalculatorLooseEntries;
  next_day_sell: number;
  total_trays: number;
  total_tray_eggs: number;
  total_loose_eggs: number;
  next_day_sell_eggs: number;
  grand_total_eggs: number;
  full_trays: number;
  remainder_eggs: number;
  stock_difference?: number | null;
  notes?: string | null;
}

export interface CalculatorHistoryFilters {
  target_date?: string;
  start_date?: string;
  end_date?: string;
  show_all?: boolean;
  product_name?: string;
  calculator_type?: string;
  timezone?: string;
  page?: number;
  size?: number;
}
