export * from "./api";
export * from "./balance_adjustment";
export * from "./customer";
export * from "./customer_collection";
export * from "./dashboard";
export * from "./expense";
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
