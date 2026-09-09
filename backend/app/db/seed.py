import os
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.core.security import get_password_hash
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.models.farm import Farm
from app.repositories.permission_repository import permission_repository
from app.repositories.role_repository import role_repository
from app.repositories.user_repository import user_repository
from app.db.seeds.settings_seed import seed_settings_and_currencies

DEFAULT_INITIAL_ACCOUNTS = [
    {
        "role_code": "owner",
        "username": "owner",
        "email": "owner@enterprise.com",
        "full_name": "System Owner",
        "phone": "+18005550199",
        "env_var": "INITIAL_OWNER_PASSWORD",
        "default_password": "Owner@Argon2Secure2026!",
    },
    {
        "role_code": "admin",
        "username": "admin",
        "email": "admin@enterprise.com",
        "full_name": "System Administrator",
        "phone": "+18005550101",
        "env_var": "INITIAL_ADMIN_PASSWORD",
        "default_password": "Admin@Argon2Secure2026!",
    },
    {
        "role_code": "employee",
        "username": "employee",
        "email": "employee@enterprise.com",
        "full_name": "System Employee",
        "phone": "+18005550102",
        "env_var": "INITIAL_EMPLOYEE_PASSWORD",
        "default_password": "Employee@Argon2Secure2026!",
    },
]

DEFAULT_PERMISSIONS = [
    # Dashboard module
    {"code": "dashboard.view", "name": "View Dashboard", "module": "dashboard", "description": "View business overview dashboard"},

    # Filtered Dashboard module
    {"code": "dashboard.filtered.view", "name": "View Filtered Dashboard", "module": "dashboard_filtered", "description": "View date-filtered business performance and analytics"},

    # Reports Center module
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
    {"code": "customer.balance.adjustment.delete", "name": "Delete Customer Balance Adjustment History", "module": "customer", "description": "Delete customer balance adjustment history records"},

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
    {"code": "supplier.balance.adjustment.delete", "name": "Delete Supplier Balance Adjustment History", "module": "supplier", "description": "Delete supplier balance adjustment history records"},

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

    # Farm module
    {"code": "farm.view", "name": "View Farm", "module": "farm", "description": "Access farm management and view tray balances"},
    {"code": "farm.create", "name": "Create Farm", "module": "farm", "description": "Add new farm locations and configure previous trays"},
    {"code": "farm.edit", "name": "Edit Farm", "module": "farm", "description": "Modify farm details and opening tray balances"},
    {"code": "farm.delete", "name": "Delete Farm", "module": "farm", "description": "Remove farm locations and associated records"},
    {"code": "farm.production.view", "name": "View Production", "module": "farm", "description": "View farm production history and batches"},
    {"code": "farm.production.create", "name": "Add Production", "module": "farm", "description": "Record daily production harvest in trays"},
    {"code": "farm.production.edit", "name": "Edit Production", "module": "farm", "description": "Modify recorded production batches"},
    {"code": "farm.production.delete", "name": "Delete Production", "module": "farm", "description": "Delete production harvest records"},
    {"code": "farm.delivery.view", "name": "View Delivery", "module": "farm", "description": "View farm delivery dispatches and history"},
    {"code": "farm.delivery.create", "name": "Add Delivery", "module": "farm", "description": "Record multi-destination delivery submissions"},
    {"code": "farm.delivery.edit", "name": "Edit Delivery", "module": "farm", "description": "Modify recorded delivery dispatches"},
    {"code": "farm.delivery.delete", "name": "Delete Delivery", "module": "farm", "description": "Delete delivery dispatch records"},
    {"code": "farm.report", "name": "View Farm Reports", "module": "farm", "description": "View date-wise production and delivery breakdown reports"},

    # User Management module
    {"code": "user.view", "name": "View Users", "module": "user", "description": "View user list and user details"},
    {"code": "user.create", "name": "Create Users", "module": "user", "description": "Create new system users"},
    {"code": "user.edit", "name": "Edit Users", "module": "user", "description": "Modify user profiles and roles"},
    {"code": "user.delete", "name": "Delete Users", "module": "user", "description": "Soft delete user accounts"},

    # Role Management module
    {"code": "role.view", "name": "View Roles & Permissions", "module": "role", "description": "View roles and permission matrices"},
    {"code": "role.edit", "name": "Manage Roles & Permissions", "module": "role", "description": "Create roles and assign permissions"},

    # Profile module
    {"code": "profile.view", "name": "View Profile", "module": "profile", "description": "View user profile details"},
    {"code": "profile.edit", "name": "Edit Profile", "module": "profile", "description": "Modify own profile name and profile logo URL"},

    # Settings module
    {"code": "settings.view", "name": "View Settings", "module": "settings", "description": "Access business and system settings"},
    {"code": "settings.edit", "name": "Edit Settings", "module": "settings", "description": "Modify business settings and preferences"},
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

    # 0. Clean up obsolete permissions
    obsolete_codes = ["farm.waste", "farm.manage", "farm.production", "farm.delivery"]
    for code in obsolete_codes:
        obs = await permission_repository.get_by_code(db, code)
        if obs:
            await db.execute(text("DELETE FROM role_permissions WHERE permission_id = :pid"), {"pid": obs.id})
            await db.delete(obs)
            await db.commit()

    # 1. Seed Permissions
    permission_map = {}
    for perm_data in DEFAULT_PERMISSIONS:
        existing = await permission_repository.get_by_code(db, perm_data["code"])
        if not existing:
            perm = await permission_repository.create(db, obj_in=perm_data)
            permission_map[perm.code] = perm
        else:
            existing.name = perm_data["name"]
            existing.module = perm_data["module"]
            existing.description = perm_data["description"]
            db.add(existing)
            permission_map[existing.code] = existing

    # 2. Seed Fixed System Roles
    role_map = {}
    newly_created_roles = set()
    for role_data in DEFAULT_ROLES:
        existing = await role_repository.get_by_code(db, role_data["code"])
        if not existing:
            role = await role_repository.create(db, obj_in=role_data)
            role_map[role.code] = role
            newly_created_roles.add(role.code)
            logger.info(f"[SEED] Created default system role: '{role.code}'")
        else:
            role_map[existing.code] = existing

    # 3. Assign Default Permissions to Admin & Employee (only if newly created or unconfigured)
    all_perms = list(permission_map.values())

    # Employee gets operational view and creation perms only (no admin/user/role/edit/delete perms)
    employee_perm_codes = {
        "dashboard.view",
        "sales.view", "sales.create",
        "customer.view", "customer.create", "customer.due.view",
        "product.view", "product.create",
        "supplier.view", "supplier.create",
        "purchase.view", "purchase.create",
        "collection.view", "collection.create",
        "supplier_payment.view", "supplier_payment.create",
        "expense.view", "expense.create",
        "farm.view", "farm.create", "farm.production.view", "farm.production.create", "farm.delivery.view", "farm.delivery.create", "farm.report",
        "profile.view", "profile.edit",
    }
    employee_perms = [p for p in all_perms if p.code in employee_perm_codes]

    # Admin gets all perms EXCEPT customer/supplier balance adjustment delete and farm delete permissions by default
    admin_restricted_perm_codes = {
        "customer.balance.adjustment.delete",
        "supplier.balance.adjustment.delete",
        "farm.delete",
        "farm.production.delete",
        "farm.delivery.delete",
    }
    admin_perms = [p for p in all_perms if p.code not in admin_restricted_perm_codes]

    admin_role = role_map.get("admin")
    if admin_role:
        if "admin" in newly_created_roles or not admin_role.permissions:
            logger.info("[SEED] Initializing default permissions for newly created Admin role...")
            await role_repository.set_role_permissions(db, admin_role, admin_perms)
        else:
            logger.info(f"[SEED] Preserving {len(admin_role.permissions)} configured permissions for Admin role.")

    # Employee gets restricted operational perms
    employee_role = role_map.get("employee")
    if employee_role:
        if "employee" in newly_created_roles or not employee_role.permissions:
            logger.info("[SEED] Initializing default permissions for newly created Employee role...")
            await role_repository.set_role_permissions(db, employee_role, employee_perms)
        else:
            logger.info(f"[SEED] Preserving {len(employee_role.permissions)} configured permissions for Employee role.")

    # 4. Seed Initial System Accounts (Owner, Admin, Employee) using Argon2id
    reset_passwords = os.getenv("RESET_DEFAULT_PASSWORDS", "").lower() in ("true", "1", "yes")

    for acc in DEFAULT_INITIAL_ACCOUNTS:
        role = role_map.get(acc["role_code"])
        if not role:
            continue

        raw_pwd = os.getenv(acc["env_var"]) or acc["default_password"]
        existing_user = await user_repository.get_by_username(db, acc["username"])

        if not existing_user:
            user_data = {
                "full_name": acc["full_name"],
                "username": acc["username"],
                "email": acc["email"],
                "phone": acc["phone"],
                "password_hash": get_password_hash(raw_pwd),
                "role_id": role.id,
                "status": "active",
            }
            created_user = await user_repository.create(db, obj_in=user_data)
            logger.info(
                f"[SEED] Created initial {acc['role_code'].upper()} account: "
                f"username='{acc['username']}', email='{acc['email']}', "
                f"hash='{created_user.password_hash[:30]}...'"
            )
        else:
            if reset_passwords:
                existing_user.password_hash = get_password_hash(raw_pwd)
                existing_user.role_id = role.id
                if not existing_user.email:
                    existing_user.email = acc["email"]
                db.add(existing_user)
                logger.info(
                    f"[SEED] Updated {acc['role_code'].upper()} account password with Argon2id: "
                    f"username='{acc['username']}'"
                )
            elif existing_user.email == "owner@system.local":
                existing_user.email = "owner@enterprise.com"
                db.add(existing_user)

    await db.commit()
    
    # 5. Seed Settings and Currencies
    await seed_settings_and_currencies(db)

    # 6. Seed Default Farm if none exists
    farm_res = await db.execute(select(Farm))
    first_farm = farm_res.scalars().first()
    if not first_farm:
        first_farm = Farm(
            name="Main Farm",
            code="FARM-001",
            address="Primary Farm Facility",
            contact_number="+18005550199",
            status="active",
            notes="Default operational farm",
        )
        db.add(first_farm)
        await db.commit()
        await db.refresh(first_farm)
        logger.info(f"[SEED] Created default farm '{first_farm.name}' ({first_farm.code})")

    logger.info("Database seeding completed successfully.")
