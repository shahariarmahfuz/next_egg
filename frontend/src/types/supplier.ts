export interface SupplierItem {
  id: string;
  supplier_code: string;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  nid?: string;
  opening_balance: number;
  current_balance: number;
  status: "active" | "inactive";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreatePayload {
  supplier_code?: string;
  name: string;
  phone?: string;
  address?: string;
  opening_balance?: number;
  status?: string;
  notes?: string;
}

export interface SupplierUpdatePayload {
  name?: string;
  phone?: string;
  address?: string;
  current_balance?: number;
  status?: string;
  notes?: string;
}
