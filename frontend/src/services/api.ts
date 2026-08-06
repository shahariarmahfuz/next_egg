import { http } from "./http";
import {
  BalanceAdjustmentItem,
  BalanceAdjustmentPayload,
  CollectionReportSummaryData,
  CustomerCollectionCreatePayload,
  CustomerCollectionItem,
  CustomerCollectionUpdatePayload,
  CustomerCreatePayload,
  CustomerDuesSummary,
  CustomerFinancialSummary,
  CustomerItem,
  CustomerLedgerResponse,
  CustomerUpdatePayload,
  DashboardCardsSummary,
  Expense,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseFilters,
  ExpenseInput,
  ExpenseReportSummary,
  HealthCheckData,
  LoginRequest,
  LowStockProductItem,
  PaginatedResult,
  PermissionItem,
  ProductCreatePayload,
  ProductItem,
  ProductReturnCreatePayload,
  ProductReturnItem,
  ProductReturnReportSummaryData,
  ProductReturnUpdatePayload,
  ProductUpdatePayload,
  PurchaseCreatePayload,
  PurchaseItem as PurchaseModelItem,
  PurchaseReportSummaryData,
  PurchaseReturnableSummary,
  PurchaseUpdatePayload,
  RecentSaleItem,
  RoleItem,
  RolePermissionAssignPayload,
  SaleCreatePayload,
  SaleItem,
  SaleReportSummaryData,
  SaleReturnableSummary,
  SaleReturnCreatePayload,
  SaleReturnItem,
  SaleReturnReportSummaryData,
  SaleReturnUpdatePayload,
  SaleUpdatePayload,
  SupplierCreatePayload,
  SupplierFinancialSummary,
  SupplierItem,
  SupplierPaymentCreatePayload,
  SupplierPaymentItem,
  SupplierPaymentReportSummaryData,
  SupplierPaymentUpdatePayload,
  SupplierUpdatePayload,
  TokenResponseData,
  UserCreatePayload,
  UserItem,
  UserUpdatePayload,
} from "@/types";

export const authService = {
  login: async (credentials: LoginRequest) => {
    return http.post<TokenResponseData>("/auth/login", credentials);
  },

  logout: async () => {
    return http.post<{}>("/auth/logout");
  },

  getMe: async () => {
    return http.get<{ user: UserItem; permissions: string[] }>("/auth/me");
  },

  refreshToken: async () => {
    return http.post<TokenResponseData>("/auth/refresh");
  },
};

export const userService = {
  getUsers: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    role_id?: string;
    status?: string;
  }) => {
    return http.get<PaginatedResult<UserItem>>("/users", params);
  },

  getUserById: async (id: string) => {
    return http.get<UserItem>(`/users/${id}`);
  },

  createUser: async (payload: UserCreatePayload) => {
    return http.post<UserItem>("/users", payload);
  },

  updateUser: async (id: string, payload: UserUpdatePayload) => {
    return http.put<UserItem>(`/users/${id}`, payload);
  },

  deleteUser: async (id: string) => {
    return http.delete<{ id: string }>(`/users/${id}`);
  },
};

export const roleService = {
  getRoles: async () => {
    return http.get<RoleItem[]>("/roles");
  },

  getRoleById: async (id: string) => {
    return http.get<RoleItem>(`/roles/${id}`);
  },

  createRole: async (payload: { name: string; code: string; description?: string; permission_ids?: string[] }) => {
    return http.post<RoleItem>("/roles", payload);
  },

  updateRole: async (id: string, payload: { name?: string; description?: string; permission_ids?: string[] }) => {
    return http.put<RoleItem>(`/roles/${id}`, payload);
  },

  updateRolePermissions: async (id: string, payload: RolePermissionAssignPayload) => {
    return http.put<RoleItem>(`/roles/${id}/permissions`, payload);
  },
};

export const permissionService = {
  getPermissions: async () => {
    return http.get<PermissionItem[]>("/permissions");
  },
};

export const productService = {
  getProducts: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    category?: string;
    status?: string;
  }) => {
    return http.get<PaginatedResult<ProductItem>>("/products", params);
  },

  getProductById: async (id: string) => {
    return http.get<ProductItem>(`/products/${id}`);
  },

  createProduct: async (payload: ProductCreatePayload) => {
    return http.post<ProductItem>("/products", payload);
  },

  updateProduct: async (id: string, payload: ProductUpdatePayload) => {
    return http.put<ProductItem>(`/products/${id}`, payload);
  },

  updateProductStatus: async (id: string, status: string) => {
    return http.patch<ProductItem>(`/products/${id}/status`, { status });
  },

  deleteProduct: async (id: string) => {
    return http.delete<{ id: string }>(`/products/${id}`);
  },

  hardDeleteProduct: async (id: string) => {
    return http.delete<{ id: string }>(`/products/${id}/hard-delete`);
  },

  getCategories: async () => {
    return http.get<string[]>("/products/categories");
  },
};

export const supplierService = {
  getSuppliers: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    status?: string;
    due_only?: boolean;
  }) => {
    return http.get<PaginatedResult<SupplierItem>>("/suppliers", params);
  },

  getSupplierDues: async (params?: {
    page?: number;
    size?: number;
    search?: string;
  }) => {
    return http.get<PaginatedResult<SupplierItem>>("/suppliers/dues", params);
  },

  getSupplierById: async (id: string) => {
    return http.get<SupplierItem>(`/suppliers/${id}`);
  },

  createSupplier: async (payload: SupplierCreatePayload) => {
    return http.post<SupplierItem>("/suppliers", payload);
  },

  updateSupplier: async (id: string, payload: SupplierUpdatePayload) => {
    return http.put<SupplierItem>(`/suppliers/${id}`, payload);
  },

  updateSupplierStatus: async (id: string, status: string) => {
    return http.patch<SupplierItem>(`/suppliers/${id}/status`, { status });
  },

  deleteSupplier: async (id: string) => {
    return http.delete<{ id: string }>(`/suppliers/${id}`);
  },

  hardDeleteSupplier: async (id: string) => {
    return http.delete<{ id: string }>(`/suppliers/${id}/hard-delete`);
  },

  adjustBalance: async (id: string, payload: BalanceAdjustmentPayload) => {
    return http.post<BalanceAdjustmentItem>(`/suppliers/${id}/adjust-balance`, payload);
  },

  getBalanceAdjustments: async (id: string) => {
    return http.get<BalanceAdjustmentItem[]>(`/suppliers/${id}/balance-adjustments`);
  },
};

export const customerService = {
  getCustomers: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    status?: string;
  }) => {
    return http.get<PaginatedResult<CustomerItem>>("/customers", params);
  },

  getCustomerDues: async (params?: {
    page?: number;
    size?: number;
    search?: string;
  }) => {
    return http.get<PaginatedResult<CustomerItem>>("/customers/dues", params);
  },

  getCustomerDuesSummary: async (params?: { search?: string }) => {
    return http.get<CustomerDuesSummary>("/customers/dues/summary", params);
  },

  getCustomerById: async (id: string) => {
    return http.get<CustomerItem>(`/customers/${id}`);
  },

  createCustomer: async (payload: CustomerCreatePayload) => {
    return http.post<CustomerItem>("/customers", payload);
  },

  updateCustomer: async (id: string, payload: CustomerUpdatePayload) => {
    return http.put<CustomerItem>(`/customers/${id}`, payload);
  },

  updateCustomerStatus: async (id: string, status: string) => {
    return http.patch<CustomerItem>(`/customers/${id}/status`, { status });
  },

  deleteCustomer: async (id: string) => {
    return http.delete<{ id: string }>(`/customers/${id}`);
  },

  hardDeleteCustomer: async (id: string) => {
    return http.delete<{ id: string }>(`/customers/${id}/hard-delete`);
  },

  adjustBalance: async (id: string, payload: BalanceAdjustmentPayload) => {
    return http.post<BalanceAdjustmentItem>(`/customers/${id}/adjust-balance`, payload);
  },

  getBalanceAdjustments: async (id: string) => {
    return http.get<BalanceAdjustmentItem[]>(`/customers/${id}/balance-adjustments`);
  },

  getCustomerLedger: async (id: string, params?: { start_date?: string; end_date?: string }) => {
    return http.get<CustomerLedgerResponse>(`/customers/${id}/ledger`, params);
  },
};

export const purchaseService = {
  getPurchases: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    supplier_id?: string;
    payment_status?: string;
  }) => {
    return http.get<PaginatedResult<PurchaseModelItem>>("/purchases", params);
  },

  getPurchaseReports: async (params?: {
    report_type?: string;
    target_date?: string;
    start_date?: string;
    end_date?: string;
    month?: number;
    year?: number;
  }) => {
    return http.get<PurchaseReportSummaryData>("/purchases/reports", params);
  },

  getPurchaseById: async (id: string) => {
    return http.get<PurchaseModelItem>(`/purchases/${id}`);
  },

  createPurchase: async (payload: PurchaseCreatePayload) => {
    return http.post<PurchaseModelItem>("/purchases", payload);
  },

  updatePurchase: async (id: string, payload: PurchaseUpdatePayload) => {
    return http.put<PurchaseModelItem>(`/purchases/${id}`, payload);
  },

  deletePurchase: async (id: string) => {
    return http.delete<{ id: string }>(`/purchases/${id}`);
  },

  hardDeletePurchase: async (id: string) => {
    return http.delete<{ id: string }>(`/purchases/${id}/hard-delete`);
  },
};

export const saleService = {
  getSales: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    customer_id?: string;
    payment_status?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
  }) => {
    return http.get<PaginatedResult<SaleItem>>("/sales", params);
  },

  getSaleReports: async (params?: {
    search?: string;
    customer_id?: string;
    payment_status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    return http.get<SaleReportSummaryData>("/sales/reports", params);
  },

  getSaleById: async (id: string) => {
    return http.get<SaleItem>(`/sales/${id}`);
  },

  createSale: async (payload: SaleCreatePayload) => {
    return http.post<SaleItem>("/sales", payload);
  },

  updateSale: async (id: string, payload: SaleUpdatePayload) => {
    return http.put<SaleItem>(`/sales/${id}`, payload);
  },

  deleteSale: async (id: string) => {
    return http.delete<{ id: string }>(`/sales/${id}`);
  },

  hardDeleteSale: async (id: string) => {
    return http.delete<{ id: string }>(`/sales/${id}/hard-delete`);
  },
};

export const collectionService = {
  getCollections: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    customer_id?: string;
    payment_method?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
  }) => {
    return http.get<PaginatedResult<CustomerCollectionItem>>("/collections", params);
  },

  getCollectionById: async (id: string) => {
    return http.get<CustomerCollectionItem>(`/collections/${id}`);
  },

  getCustomerSummary: async (customerId: string) => {
    return http.get<CustomerFinancialSummary>(`/collections/customer-summary/${customerId}`);
  },

  getCollectionReports: async (params?: {
    preset_range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    customer_id?: string;
    payment_method?: string;
  }) => {
    return http.get<CollectionReportSummaryData>("/collections/reports", params);
  },

  createCollection: async (payload: CustomerCollectionCreatePayload) => {
    return http.post<CustomerCollectionItem>("/collections", payload);
  },

  updateCollection: async (id: string, payload: CustomerCollectionUpdatePayload) => {
    return http.put<CustomerCollectionItem>(`/collections/${id}`, payload);
  },

  deleteCollection: async (id: string) => {
    return http.delete<{ id: string }>(`/collections/${id}`);
  },

  hardDeleteCollection: async (id: string) => {
    return http.delete<{ id: string }>(`/collections/${id}/hard-delete`);
  },
};

export const saleReturnService = {
  getSaleReturns: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    customer_id?: string;
    sale_id?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
  }) => {
    return http.get<PaginatedResult<SaleReturnItem>>("/sale-returns", params);
  },

  getSaleReturnById: async (id: string) => {
    return http.get<SaleReturnItem>(`/sale-returns/${id}`);
  },

  getReturnableInfo: async (saleIdentifier: string) => {
    return http.get<SaleReturnableSummary>(`/sale-returns/returnable-info/${saleIdentifier}`);
  },

  getSaleReturnReports: async (params?: {
    preset_range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    customer_id?: string;
  }) => {
    return http.get<SaleReturnReportSummaryData>("/sale-returns/reports", params);
  },

  createSaleReturn: async (payload: SaleReturnCreatePayload) => {
    return http.post<SaleReturnItem>("/sale-returns", payload);
  },

  updateSaleReturn: async (id: string, payload: SaleReturnUpdatePayload) => {
    return http.put<SaleReturnItem>(`/sale-returns/${id}`, payload);
  },

  deleteSaleReturn: async (id: string) => {
    return http.delete<{ id: string }>(`/sale-returns/${id}`);
  },

  hardDeleteSaleReturn: async (id: string) => {
    return http.delete<{ id: string }>(`/sale-returns/${id}/hard-delete`);
  },
};

export const productReturnService = {
  getProductReturns: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    supplier_id?: string;
    purchase_id?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
  }) => {
    return http.get<PaginatedResult<ProductReturnItem>>("/product-returns", params);
  },

  getProductReturnById: async (id: string) => {
    return http.get<ProductReturnItem>(`/product-returns/${id}`);
  },

  getReturnableInfo: async (purchaseIdentifier: string) => {
    return http.get<PurchaseReturnableSummary>(`/product-returns/returnable-info/${purchaseIdentifier}`);
  },

  getProductReturnReports: async (params?: {
    preset_range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    supplier_id?: string;
  }) => {
    return http.get<ProductReturnReportSummaryData>("/product-returns/reports", params);
  },

  createProductReturn: async (payload: ProductReturnCreatePayload) => {
    return http.post<ProductReturnItem>("/product-returns", payload);
  },

  updateProductReturn: async (id: string, payload: ProductReturnUpdatePayload) => {
    return http.put<ProductReturnItem>(`/product-returns/${id}`, payload);
  },

  deleteProductReturn: async (id: string) => {
    return http.delete<{ id: string }>(`/product-returns/${id}`);
  },

  hardDeleteProductReturn: async (id: string) => {
    return http.delete<{ id: string }>(`/product-returns/${id}/hard-delete`);
  },
};

export const supplierPaymentService = {
  getSupplierPayments: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    supplier_id?: string;
    payment_method?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
  }) => {
    return http.get<PaginatedResult<SupplierPaymentItem>>("/supplier-payments", params);
  },

  getSupplierPaymentById: async (id: string) => {
    return http.get<SupplierPaymentItem>(`/supplier-payments/${id}`);
  },

  getSupplierFinancialSummary: async (supplierId: string) => {
    return http.get<SupplierFinancialSummary>(`/supplier-payments/supplier-summary/${supplierId}`);
  },

  getSupplierPaymentReports: async (params?: {
    preset_range?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    supplier_id?: string;
    payment_method?: string;
  }) => {
    return http.get<SupplierPaymentReportSummaryData>("/supplier-payments/reports", params);
  },

  createSupplierPayment: async (payload: SupplierPaymentCreatePayload) => {
    return http.post<SupplierPaymentItem>("/supplier-payments", payload);
  },

  updateSupplierPayment: async (id: string, payload: SupplierPaymentUpdatePayload) => {
    return http.put<SupplierPaymentItem>(`/supplier-payments/${id}`, payload);
  },

  deleteSupplierPayment: async (id: string) => {
    return http.delete<{ id: string }>(`/supplier-payments/${id}`);
  },

  hardDeleteSupplierPayment: async (id: string) => {
    return http.delete<{ id: string }>(`/supplier-payments/${id}/hard-delete`);
  },
};

export const dashboardService = {
  getSummary: async () => {
    return http.get<DashboardCardsSummary>("/dashboard/summary");
  },

  getRecentSales: async () => {
    return http.get<RecentSaleItem[]>("/dashboard/recent-sales");
  },

  getLowStockProducts: async () => {
    return http.get<LowStockProductItem[]>("/dashboard/low-stock-products");
  },
};

export const systemService = {
  getHealth: async () => {
    return http.get<HealthCheckData>("/health");
  },
};

export const expenseService = {
  getCategories: async (active_only = false) => {
    return http.get<ExpenseCategory[]>(`/expenses/categories?active_only=${active_only}`);
  },

  createCategory: async (payload: ExpenseCategoryInput) => {
    return http.post<ExpenseCategory>("/expenses/categories", payload);
  },

  updateCategory: async (id: string, payload: Partial<ExpenseCategoryInput>) => {
    return http.put<ExpenseCategory>(`/expenses/categories/${id}`, payload);
  },

  deleteCategory: async (id: string) => {
    return http.delete<{ id: string }>(`/expenses/categories/${id}`);
  },

  getExpenses: async (filters: ExpenseFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.category_id) params.append("category_id", filters.category_id);
    if (filters.payment_method) params.append("payment_method", filters.payment_method);
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.page_size) params.append("page_size", filters.page_size.toString());

    const queryString = params.toString();
    return http.get<PaginatedResult<Expense>>(`/expenses${queryString ? `?${queryString}` : ""}`);
  },

  getExpenseById: async (id: string) => {
    return http.get<Expense>(`/expenses/${id}`);
  },

  createExpense: async (payload: ExpenseInput) => {
    return http.post<Expense>("/expenses", payload);
  },

  updateExpense: async (id: string, payload: Partial<ExpenseInput>) => {
    return http.put<Expense>(`/expenses/${id}`, payload);
  },

  deleteExpense: async (id: string) => {
    return http.delete<{ id: string }>(`/expenses/${id}`);
  },

  hardDeleteExpense: async (id: string) => {
    return http.delete<{ id: string }>(`/expenses/${id}/hard-delete`);
  },

  getReportSummary: async (filters: Omit<ExpenseFilters, "search" | "page" | "page_size"> = {}) => {
    const params = new URLSearchParams();
    if (filters.category_id) params.append("category_id", filters.category_id);
    if (filters.payment_method) params.append("payment_method", filters.payment_method);
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);

    const queryString = params.toString();
    return http.get<ExpenseReportSummary>(`/expenses/report/summary${queryString ? `?${queryString}` : ""}`);
  },
};

