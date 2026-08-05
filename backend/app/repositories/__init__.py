from app.repositories.base import BaseRepository
from app.repositories.customer_repository import customer_repository
from app.repositories.permission_repository import permission_repository
from app.repositories.product_repository import product_repository
from app.repositories.purchase_repository import purchase_repository
from app.repositories.role_repository import role_repository
from app.repositories.sale_repository import sale_repository
from app.repositories.supplier_repository import supplier_repository
from app.repositories.user_repository import user_repository

__all__ = [
    "BaseRepository",
    "user_repository",
    "role_repository",
    "permission_repository",
    "product_repository",
    "supplier_repository",
    "purchase_repository",
    "customer_repository",
    "sale_repository",
]
