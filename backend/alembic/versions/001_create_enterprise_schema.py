"""create_enterprise_schema_postgresql

Revision ID: 001_enterprise_schema
Revises: 
Create Date: 2026-08-04 09:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_enterprise_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely clean legacy tables if present using PostgreSQL DROP CASCADE
    op.execute("DROP TABLE IF EXISTS role_permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS user_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS purchase_items CASCADE")
    op.execute("DROP TABLE IF EXISTS purchases CASCADE")
    op.execute("DROP TABLE IF EXISTS supplier_payments CASCADE")
    op.execute("DROP TABLE IF EXISTS product_return_items CASCADE")
    op.execute("DROP TABLE IF EXISTS product_returns CASCADE")
    op.execute("DROP TABLE IF EXISTS sale_items CASCADE")
    op.execute("DROP TABLE IF EXISTS sales CASCADE")
    op.execute("DROP TABLE IF EXISTS customer_collections CASCADE")
    op.execute("DROP TABLE IF EXISTS sale_return_items CASCADE")
    op.execute("DROP TABLE IF EXISTS sale_returns CASCADE")
    op.execute("DROP TABLE IF EXISTS activity_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    op.execute("DROP TABLE IF EXISTS permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
    op.execute("DROP TABLE IF EXISTS suppliers CASCADE")
    op.execute("DROP TABLE IF EXISTS customers CASCADE")
    op.execute("DROP TABLE IF EXISTS settings CASCADE")

    # 1. permissions
    op.create_table(
        'permissions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('module', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('idx_permission_code', 'permissions', ['code'])
    op.create_index('idx_permission_module', 'permissions', ['module'])

    # 2. roles
    op.create_table(
        'roles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_role_code', 'roles', ['code'])

    # 3. role_permissions
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.String(length=36), nullable=False),
        sa.Column('permission_id', sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )

    # 4. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role_id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    op.create_index('idx_user_email', 'users', ['email'])
    op.create_index('idx_user_status_role', 'users', ['status', 'role_id'])
    op.create_index('idx_user_username', 'users', ['username'])

    # 5. user_roles
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('role_id', sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'role_id')
    )

    # 6. suppliers
    op.create_table(
        'suppliers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('supplier_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('company_name', sa.String(length=150), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('nid', sa.String(length=50), nullable=True),
        sa.Column('opening_balance', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('current_balance', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('supplier_code'),
        sa.UniqueConstraint('phone')
    )
    op.create_index('idx_supplier_balance', 'suppliers', ['current_balance'])
    op.create_index('idx_supplier_code', 'suppliers', ['supplier_code'])
    op.create_index('idx_supplier_name', 'suppliers', ['name'])
    op.create_index('idx_supplier_phone', 'suppliers', ['phone'])

    # 7. customers
    op.create_table(
        'customers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('customer_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('nid', sa.String(length=50), nullable=True),
        sa.Column('opening_balance', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('current_balance', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('credit_limit', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_code'),
        sa.UniqueConstraint('phone')
    )
    op.create_index('idx_customer_balance', 'customers', ['current_balance'])
    op.create_index('idx_customer_code', 'customers', ['customer_code'])
    op.create_index('idx_customer_name', 'customers', ['name'])
    op.create_index('idx_customer_phone', 'customers', ['phone'])

    # 8. products
    op.create_table(
        'products',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('brand', sa.String(length=100), nullable=True),
        sa.Column('unit', sa.String(length=30), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=True),
        sa.Column('opening_stock', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('current_stock', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('purchase_price', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('selling_price', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('minimum_stock', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('current_stock >= 0', name='chk_product_stock_non_negative'),
        sa.CheckConstraint('purchase_price >= 0', name='chk_product_purchase_price_positive'),
        sa.CheckConstraint('selling_price >= 0', name='chk_product_selling_price_positive'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_code'),
        sa.UniqueConstraint('barcode')
    )
    op.create_index('idx_product_barcode', 'products', ['barcode'])
    op.create_index('idx_product_brand', 'products', ['brand'])
    op.create_index('idx_product_category', 'products', ['category'])
    op.create_index('idx_product_code', 'products', ['product_code'])
    op.create_index('idx_product_status_name', 'products', ['status', 'name'])

    # 9. purchases
    op.create_table(
        'purchases',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('purchase_no', sa.String(length=50), nullable=False),
        sa.Column('invoice_no', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('purchase_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('grand_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('paid_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('due_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='unpaid'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('purchase_no')
    )
    op.create_index('idx_purchase_no', 'purchases', ['purchase_no'])
    op.create_index('idx_purchase_supplier_date', 'purchases', ['supplier_id', 'purchase_date'])

    # 10. purchase_items
    op.create_table(
        'purchase_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('purchase_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('discount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_purchase_item_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_purchase_item_price_positive'),
        sa.CheckConstraint('total_price >= 0', name='chk_purchase_item_total_positive'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_purchase_item_product', 'purchase_items', ['product_id'])
    op.create_index('idx_purchase_item_purchase', 'purchase_items', ['purchase_id'])

    # 11. supplier_payments
    op.create_table(
        'supplier_payments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('payment_no', sa.String(length=50), nullable=False),
        sa.Column('supplier_id', sa.String(length=36), nullable=False),
        sa.Column('purchase_id', sa.String(length=36), nullable=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('reference_no', sa.String(length=100), nullable=True),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_spay_amount_positive'),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_no')
    )
    op.create_index('idx_spay_no', 'supplier_payments', ['payment_no'])
    op.create_index('idx_spay_purchase', 'supplier_payments', ['purchase_id'])
    op.create_index('idx_spay_supplier', 'supplier_payments', ['supplier_id'])

    # 12. product_returns
    op.create_table(
        'product_returns',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('return_no', sa.String(length=50), nullable=False),
        sa.Column('purchase_id', sa.String(length=36), nullable=True),
        sa.Column('supplier_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('return_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('grand_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('refund_received', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_no')
    )
    op.create_index('idx_pret_no', 'product_returns', ['return_no'])
    op.create_index('idx_pret_purchase', 'product_returns', ['purchase_id'])
    op.create_index('idx_pret_supplier', 'product_returns', ['supplier_id'])

    # 13. product_return_items
    op.create_table(
        'product_return_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_return_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_pret_item_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_pret_item_price_positive'),
        sa.CheckConstraint('total_price >= 0', name='chk_pret_item_total_positive'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['product_return_id'], ['product_returns.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_pret_item_product', 'product_return_items', ['product_id'])
    op.create_index('idx_pret_item_return', 'product_return_items', ['product_return_id'])

    # 14. sales
    op.create_table(
        'sales',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('invoice_no', sa.String(length=50), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('sale_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('grand_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('paid_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('due_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='unpaid'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_no')
    )
    op.create_index('idx_sale_customer_date', 'sales', ['customer_id', 'sale_date'])
    op.create_index('idx_sale_invoice_no', 'sales', ['invoice_no'])

    # 15. sale_items
    op.create_table(
        'sale_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('sale_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('discount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_sale_item_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_sale_item_price_positive'),
        sa.CheckConstraint('total_price >= 0', name='chk_sale_item_total_positive'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sale_item_product', 'sale_items', ['product_id'])
    op.create_index('idx_sale_item_sale', 'sale_items', ['sale_id'])

    # 16. customer_collections
    op.create_table(
        'customer_collections',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('collection_no', sa.String(length=50), nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('sale_id', sa.String(length=36), nullable=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('reference_no', sa.String(length=100), nullable=True),
        sa.Column('collection_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_col_amount_positive'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('collection_no')
    )
    op.create_index('idx_col_customer', 'customer_collections', ['customer_id'])
    op.create_index('idx_col_no', 'customer_collections', ['collection_no'])
    op.create_index('idx_col_sale', 'customer_collections', ['sale_id'])

    # 17. sale_returns
    op.create_table(
        'sale_returns',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('return_no', sa.String(length=50), nullable=False),
        sa.Column('sale_id', sa.String(length=36), nullable=True),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('return_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('grand_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('refund_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_no')
    )
    op.create_index('idx_sret_customer', 'sale_returns', ['customer_id'])
    op.create_index('idx_sret_no', 'sale_returns', ['return_no'])
    op.create_index('idx_sret_sale', 'sale_returns', ['sale_id'])

    # 18. sale_return_items
    op.create_table(
        'sale_return_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('sale_return_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_sret_item_qty_positive'),
        sa.CheckConstraint('unit_price >= 0', name='chk_sret_item_price_positive'),
        sa.CheckConstraint('total_price >= 0', name='chk_sret_item_total_positive'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_return_id'], ['sale_returns.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sret_item_product', 'sale_return_items', ['product_id'])
    op.create_index('idx_sret_item_return', 'sale_return_items', ['sale_return_id'])

    # 19. settings
    op.create_table(
        'settings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('group_name', sa.String(length=50), nullable=False, server_default='general'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    op.create_index('idx_settings_group', 'settings', ['group_name'])
    op.create_index('idx_settings_key', 'settings', ['key'])

    # 20. activity_logs
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.String(length=36), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_log_created', 'activity_logs', ['created_at'])
    op.create_index('idx_log_entity', 'activity_logs', ['entity_type', 'entity_id'])
    op.create_index('idx_log_user_action', 'activity_logs', ['user_id', 'action'])


def downgrade() -> None:
    op.drop_table('activity_logs')
    op.drop_table('settings')
    op.drop_table('sale_return_items')
    op.drop_table('sale_returns')
    op.drop_table('customer_collections')
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.drop_table('product_return_items')
    op.drop_table('product_returns')
    op.drop_table('supplier_payments')
    op.drop_table('purchase_items')
    op.drop_table('purchases')
    op.drop_table('products')
    op.drop_table('customers')
    op.drop_table('suppliers')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')
