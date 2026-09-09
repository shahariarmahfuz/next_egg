export * from "./api";
export * from "./balance_adjustment";
export * from "./customer";
export * from "./customer_collection";
export * from "./dashboard";
export * from "./expense";
export * from "./farm";
export * from "./nav";
export * from "./permission";
export * from "./product";
export * from "./product_return";
export * from "./purchase";
export * from "./role";
export * from "./sale";
export * from "./sale_return";
export * from "./supplier";
export * from "./supplier_payment";
export * from "./user";

export interface CustomerFinancialSummary {
  customer_id: string;
  name: string;
  customer_code: string;
  phone: string;
  opening_balance: number;
  current_due: number;
  advance_balance: number;
  total_sales: number;
  total_paid: number;
  total_returns: number;
  remaining_due: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  remember_me: boolean;
}

export interface TokenResponseData {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: import("./user").UserItem;
  permissions: string[];
}

export interface LoginResponseData {
  recovery_required?: boolean;
  recovery_verified?: boolean;
  recovery_token?: string;
  username?: string;
  message?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: import("./user").UserItem;
  permissions?: string[];
}

export interface RecoveryVerifyRequest {
  username: string;
  recovery_code: string;
}

export interface RecoveryVerifyResponse {
  recovery_token: string;
  username: string;
  message: string;
}

export interface RecoveryResetPasswordRequest {
  recovery_token: string;
  new_password: string;
}
