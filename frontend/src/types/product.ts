export interface ProductItem {
  id: string;
  product_code: string;
  name: string;
  category?: string;
  brand?: string;
  barcode?: string;
  unit: string;
  opening_stock: number;
  current_stock: number;
  available_stock: number;
  opening_stock_unit_cost: number;
  selling_price: number;
  minimum_stock: number;
  status: "active" | "inactive";
  is_low_stock?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCreatePayload {
  product_code?: string;
  name: string;
  category?: string;
  brand?: string;
  barcode?: string;
  unit: string;
  opening_stock_unit_cost: number;
  selling_price: number;
  opening_stock: number;
  minimum_stock: number;
  notes?: string;
}

export interface ProductUpdatePayload {
  name?: string;
  category?: string;
  brand?: string;
  barcode?: string;
  unit?: string;
  opening_stock_unit_cost?: number;
  selling_price?: number;
  minimum_stock?: number;
  status?: string;
  notes?: string;
}
