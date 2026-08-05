from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.core.security import get_password_hash
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.repositories.role_repository import role_repository
from app.repositories.user_repository import user_repository

DEFAULT_PERMISSIONS = [
    # Dashboard module
    {"code": "dashboard.view", "name": "View Dashboard", "module": "dashboard", "description": "View business overview dashboard"},

    # Reports Central module
    {"code": "reports.view", "name": "View Reports Center", "module": "reports", "description": "View centralized analytics & reporting hub"},

    # Sales module
    {"code": "sales.view", "name": "View Sales", "module": "sales", "description": "View sales transactions and records"},
    {"code": "sales.create", "name": "Create Sales", "module": "sales", "description": "Create new sales transactions"},
    {"code": "sales.edit", "name": "Edit Sales", "module": "sales", "description": "Update existing sales records"},
    {"code": "sales.delete", "name": "Delete Sales", "module": "sales", "description": "Delete sales transactions"},
    {"code": "sales.print", "name": "Print Sales Invoice", "module": "sales", "description": "Print sales invoice in A4, A5, and 80mm POS formats"},
    {"code": "sales.report.view", "name": "View Sales Report", "module": "sales", "description": "View sales summary and metrics reports"},
    {"code": "sales.report.export", "name": "Export Sales Report", "module": "sales", "description": "Export sales report to PDF, Excel, CSV"},

    # Sale Return module
    {"code": "sale_return.view", "name": "View Sale Returns", "module": "sale_return", "description": "View sale return vouchers and list"},
    {"code": "sale_return.create", "name": "Create Sale Return", "module": "sale_return", "description": "Process customer product returns"},
    {"code": "sale_return.edit", "name": "Edit Sale Return", "module": "sale_return", "description": "Modify sale return vouchers"},
    {"code": "sale_return.delete", "name": "Delete Sale Return", "module": "sale_return", "description": "Delete sale return vouchers"},
    {"code": "sale_return.report", "name": "View Sale Return Reports", "module": "sale_return", "description": "View and export sale return reports"},


    # Customer module
    {"code": "customer.view", "name": "View Customers", "module": "customer", "description": "View customer profiles and list"},
    {"code": "customer.create", "name": "Create Customers", "module": "customer", "description": "Add new customer profiles"},
    {"code": "customer.edit", "name": "Edit Customers", "module": "customer", "description": "Modify customer information"},
    {"code": "customer.delete", "name": "Delete Customers", "module": "customer", "description": "Delete customer records"},
    {"code": "customer.due.view", "name": "View Customer Dues", "module": "customer", "description": "View customer due list"},
    {"code": "customer.balance.adjust", "name": "Set Customer Balance", "module": "customer", "description": "Set customer current balance directly"},

    # Collection module
    {"code": "collection.view", "name": "View Customer Collections", "module": "collection", "description": "View customer collection vouchers and list"},
    {"code": "collection.create", "name": "Create Customer Collection", "module": "collection", "description": "Add new customer collection payment"},
    {"code": "collection.edit", "name": "Edit Customer Collection", "module": "collection", "description": "Update customer collection details"},
    {"code": "collection.delete", "name": "Delete Customer Collection", "module": "collection", "description": "Delete customer collection payment"},
    {"code": "collection.report", "name": "View Collection Reports", "module": "collection", "description": "View and export collection reports"},


    # Product module
    {"code": "product.view", "name": "View Products", "module": "product", "description": "View product catalog and inventory"},
    {"code": "product.create", "name": "Create Products", "module": "product", "description": "Add new products to catalog"},
    {"code": "product.edit", "name": "Edit Products", "module": "product", "description": "Update product details and pricing"},
    {"code": "product.delete", "name": "Delete Products", "module": "product", "description": "Remove products from catalog"},

    # Supplier module
    {"code": "supplier.view", "name": "View Suppliers", "module": "supplier", "description": "View supplier catalog and contact info"},
    {"code": "supplier.create", "name": "Create Suppliers", "module": "supplier", "description": "Add new suppliers"},
    {"code": "supplier.edit", "name": "Edit Suppliers", "module": "supplier", "description": "Modify supplier information"},
    {"code": "supplier.delete", "name": "Delete Suppliers", "module": "supplier", "description": "Remove supplier records"},
    {"code": "supplier.balance.adjust", "name": "Set Supplier Balance", "module": "supplier", "description": "Set supplier current balance directly"},

    # Supplier Payment module
    {"code": "supplier_payment.view", "name": "View Supplier Payments", "module": "supplier_payment", "description": "View supplier payment vouchers and list"},
    {"code": "supplier_payment.create", "name": "Create Supplier Payment", "module": "supplier_payment", "description": "Add new supplier payment voucher"},
    {"code": "supplier_payment.edit", "name": "Edit Supplier Payment", "module": "supplier_payment", "description": "Update supplier payment details"},
    {"code": "supplier_payment.delete", "name": "Delete Supplier Payment", "module": "supplier_payment", "description": "Delete supplier payment voucher"},
    {"code": "supplier_payment.report", "name": "View Supplier Payment Reports", "module": "supplier_payment", "description": "View and export supplier payment reports"},


    # Purchase module
    {"code": "purchase.view", "name": "View Purchases", "module": "purchase", "description": "View purchase orders and items"},
    {"code": "purchase.create", "name": "Create Purchases", "module": "purchase", "description": "Create purchase orders"},
    {"code": "purchase.edit", "name": "Edit Purchases", "module": "purchase", "description": "Edit purchase orders"},
    {"code": "purchase.delete", "name": "Delete Purchases", "module": "purchase", "description": "Delete purchase orders"},
    {"code": "purchase.report", "name": "Purchase Report", "module": "purchase", "description": "View purchase reports"},

    # Product Return module
    {"code": "product_return.view", "name": "View Product Returns", "module": "product_return", "description": "View supplier product return vouchers and list"},
    {"code": "product_return.create", "name": "Create Product Return", "module": "product_return", "description": "Process returns of products back to suppliers"},
    {"code": "product_return.edit", "name": "Edit Product Return", "module": "product_return", "description": "Modify product return vouchers"},
    {"code": "product_return.delete", "name": "Delete Product Return", "module": "product_return", "description": "Delete product return vouchers"},
    {"code": "product_return.report", "name": "View Product Return Reports", "module": "product_return", "description": "View and export product return reports"},


    # Expense module
    {"code": "expense.category.view", "name": "View Expense Categories", "module": "expense", "description": "View expense titles and categories"},
    {"code": "expense.category.create", "name": "Create Expense Category", "module": "expense", "description": "Add new expense categories"},
    {"code": "expense.category.edit", "name": "Edit Expense Category", "module": "expense", "description": "Modify expense category details"},
    {"code": "expense.category.delete", "name": "Delete Expense Category", "module": "expense", "description": "Remove unused expense categories"},
    {"code": "expense.view", "name": "View Expenses", "module": "expense", "description": "View expense entries and vouchers"},
    {"code": "expense.create", "name": "Create Expense", "module": "expense", "description": "Record new business expense vouchers"},
    {"code": "expense.edit", "name": "Edit Expense", "module": "expense", "description": "Modify expense entries"},
    {"code": "expense.delete", "name": "Delete Expense", "module": "expense", "description": "Delete expense vouchers"},
    {"code": "expense.report.view", "name": "View Expense Report", "module": "expense", "description": "View expense summary and reports"},
    {"code": "expense.report.export", "name": "Export Expense Report", "module": "expense", "description": "Export expense reports to PDF, Excel, CSV"},

    # Reports module
    {"code": "reports.view", "name": "View Reports", "module": "reports", "description": "Access system reports and analytics"},

    # User Management module
    {"code": "user.view", "name": "View Users", "module": "user", "description": "View user list and user details"},
    {"code": "user.create", "name": "Create Users", "module": "user", "description": "Create new system users"},
    {"code": "user.edit", "name": "Edit Users", "module": "user", "description": "Modify user profiles and roles"},
    {"code": "user.delete", "name": "Delete Users", "module": "user", "description": "Soft delete user accounts"},

    # Role Management module
    {"code": "role.view", "name": "View Roles", "module": "role", "description": "View roles and permission matrices"},
    {"code": "role.edit", "name": "Edit Roles", "module": "role", "description": "Create roles and assign permissions"},
]

DEFAULT_ROLES = [
    {
        "code": "owner",
        "name": "Owner",
        "description": "Full access to all system resources and administrative actions",
        "is_system": True,
    },
    {
        "code": "admin",
        "name": "Admin",
        "description": "Configurable System Administrator with full operational management",
        "is_system": True,
    },
    {
        "code": "employee",
        "name": "Employee",
        "description": "Configurable Staff role with customizable operational permissions",
        "is_system": True,
    },
]


async def seed_initial_data(db: AsyncSession) -> None:
    """
    Idempotent database initializer seeding default roles, permissions, and initial owner user.
    """
    logger.info("Initializing system database seed...")

    # 1. Seed Permissions
    permission_map = {}
    for perm_data in DEFAULT_PERMISSIONS:
        existing = await permission_repository.get_by_code(db, perm_data["code"])
        if not existing:
            perm = await permission_repository.create(db, obj_in=perm_data)
            permission_map[perm.code] = perm
        else:
            permission_map[existing.code] = existing

    # 2. Seed Fixed System Roles
    role_map = {}
    for role_data in DEFAULT_ROLES:
        existing = await role_repository.get_by_code(db, role_data["code"])
        if not existing:
            role = await role_repository.create(db, obj_in=role_data)
            role_map[role.code] = role
        else:
            role_map[existing.code] = existing

    # 3. Assign Default Permissions to Admin & Employee
    all_perms = list(permission_map.values())
    view_perms = [p for p in all_perms if p.code.endswith(".view")]

    # Admin gets all perms
    if role_map.get("admin") and not role_map["admin"].permissions:
        await role_repository.set_role_permissions(db, role_map["admin"], all_perms)

    # Employee gets view perms by default
    if role_map.get("employee") and not role_map["employee"].permissions:
        await role_repository.set_role_permissions(db, role_map["employee"], view_perms)

    # 4. Seed Initial System Owner Account
    owner_role = role_map.get("owner")
    if owner_role:
        existing_owner = await user_repository.get_by_username(db, "owner")
        if not existing_owner:
            owner_user_data = {
                "full_name": "System Owner",
                "username": "owner",
                "email": "owner@enterprise.com",
                "phone": "+18005550199",
                "password_hash": get_password_hash("Owner@123456"),
                "role_id": owner_role.id,
                "status": "active",
            }
            await user_repository.create(db, obj_in=owner_user_data)
            logger.info("Created default system owner account: [username: owner / password: Owner@123456]")
        elif existing_owner.email == "owner@system.local":
            existing_owner.email = "owner@enterprise.com"
            db.add(existing_owner)

    await db.commit()
    logger.info("Database seeding completed successfully.")
