from app.schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse
from app.schemas.common import ErrorDetail, ErrorResponseModel, PaginatedResponse, ResponseModel
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerStatusUpdate, CustomerUpdate
from app.schemas.dashboard import DashboardCardsSummary, DashboardDataResponse, LowStockProductItem, RecentSaleItem
from app.schemas.health import HealthCheckResponse
from app.schemas.permission import PermissionCreate, PermissionResponse
from app.schemas.product import ProductCreate, ProductResponse, ProductStatusUpdate, ProductUpdate
from app.schemas.product_return import (
    DailyProductReturnBreakdown,
    ProductReturnCreate,
    ProductReturnItemCreate,
    ProductReturnItemResponse,
    ProductReturnReportSummaryData,
    ProductReturnResponse,
    ProductReturnUpdate,
    PurchaseReturnableItem,
    PurchaseReturnableSummary,
)
from app.schemas.purchase import (
    PurchaseCreate,
    PurchaseItemCreate,
    PurchaseItemResponse,
    PurchaseReportSummary,
    PurchaseResponse,
    PurchaseUpdate,
)
from app.schemas.role import RoleCreate, RolePermissionAssign, RoleResponse, RoleUpdate
from app.schemas.sale import (
    SaleCreate,
    SaleItemCreate,
    SaleItemResponse,
    SaleReportSummary,
    SaleResponse,
    SaleUpdate,
)
from app.schemas.customer_collection import (
    CollectionReportSummaryData,
    CustomerCollectionCreate,
    CustomerCollectionResponse,
    CustomerCollectionUpdate,
    CustomerFinancialSummary,
)
from app.schemas.sale_return import (
    DailyReturnBreakdown,
    SaleReturnCreate,
    SaleReturnItemCreate,
    SaleReturnItemResponse,
    SaleReturnableItem,
    SaleReturnableSummary,
    SaleReturnReportSummaryData,
    SaleReturnResponse,
    SaleReturnUpdate,
)
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierStatusUpdate, SupplierUpdate
from app.schemas.supplier_payment import (
    DailySupplierPaymentBreakdown,
    SupplierFinancialSummary,
    SupplierPaymentCreate,
    SupplierPaymentReportSummaryData,
    SupplierPaymentResponse,
    SupplierPaymentUpdate,
)
from app.schemas.user import UserCreate, UserResponse, UserUpdate

__all__ = [
    "ResponseModel",
    "PaginatedResponse",
    "ErrorDetail",
    "ErrorResponseModel",
    "HealthCheckResponse",
    "LoginRequest",
    "TokenResponse",
    "RefreshTokenRequest",
    "PermissionCreate",
    "PermissionResponse",
    "RoleCreate",
    "RoleResponse",
    "RoleUpdate",
    "RolePermissionAssign",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    "ProductCreate",
    "ProductUpdate",
    "ProductStatusUpdate",
    "ProductResponse",
    "SupplierCreate",
    "SupplierUpdate",
    "SupplierStatusUpdate",
    "SupplierResponse",
    "PurchaseItemCreate",
    "PurchaseItemResponse",
    "PurchaseCreate",
    "PurchaseUpdate",
    "PurchaseResponse",
    "PurchaseReportSummary",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerStatusUpdate",
    "CustomerResponse",
    "CustomerCollectionCreate",
    "CustomerCollectionUpdate",
    "CustomerCollectionResponse",
    "CustomerFinancialSummary",
    "CollectionReportSummaryData",
    "SaleItemCreate",
    "SaleItemResponse",
    "SaleCreate",
    "SaleUpdate",
    "SaleResponse",
    "SaleReportSummary",
    "SaleReturnItemCreate",
    "SaleReturnItemResponse",
    "SaleReturnCreate",
    "SaleReturnUpdate",
    "SaleReturnResponse",
    "SaleReturnableItem",
    "SaleReturnableSummary",
    "DailyReturnBreakdown",
    "SaleReturnReportSummaryData",
    "ProductReturnItemCreate",
    "ProductReturnItemResponse",
    "ProductReturnCreate",
    "ProductReturnUpdate",
    "ProductReturnResponse",
    "PurchaseReturnableItem",
    "PurchaseReturnableSummary",
    "DailyProductReturnBreakdown",
    "ProductReturnReportSummaryData",
    "SupplierPaymentCreate",
    "SupplierPaymentUpdate",
    "SupplierPaymentResponse",
    "SupplierFinancialSummary",
    "DailySupplierPaymentBreakdown",
    "SupplierPaymentReportSummaryData",
]




