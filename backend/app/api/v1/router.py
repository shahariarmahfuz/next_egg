from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    balance_adjustments,
    currencies,
    customer_collections,
    customers,
    dashboard,
    expense,
    health,
    permissions,
    product_returns,
    products,
    purchases,
    roles,
    sale_returns,
    sales,
    settings,
    supplier_payments,
    suppliers,
    users,
)

api_router = APIRouter()


# Register Endpoint Routers
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(permissions.router)
api_router.include_router(dashboard.router)
api_router.include_router(products.router)
api_router.include_router(suppliers.router)
api_router.include_router(purchases.router)
api_router.include_router(customers.router)
api_router.include_router(sales.router)
api_router.include_router(customer_collections.router)
api_router.include_router(sale_returns.router)
api_router.include_router(product_returns.router)
api_router.include_router(supplier_payments.router)
api_router.include_router(balance_adjustments.router)
api_router.include_router(expense.router)
api_router.include_router(currencies.router)
api_router.include_router(settings.router)
