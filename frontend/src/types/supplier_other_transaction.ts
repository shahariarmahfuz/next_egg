import { SupplierItem } from "./supplier";
import { UserItem } from "./user";

export interface SupplierOtherTransactionItem {
  id: string;
  voucher_no: string;
  supplier_id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  supplier?: SupplierItem;
  user?: Partial<UserItem>;
}

export interface SupplierOtherTransactionCreatePayload {
  supplier_id: string;
  transaction_type?: string;
  amount: number;
  transaction_date?: string | null;
  reference_no?: string | null;
  notes?: string | null;
}

export interface SupplierOtherTransactionUpdatePayload {
  amount?: number;
  transaction_date?: string | null;
  reference_no?: string | null;
  notes?: string | null;
}
