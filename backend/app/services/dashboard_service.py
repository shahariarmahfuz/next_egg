from typing import List
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Customer, Expense, Product, Purchase, Sale, Supplier, User
from app.schemas.dashboard import (
    DashboardCardsSummary,
    LowStockProductItem,
    RecentSaleItem,
)


class DashboardService:
    async def get_dashboard_summary(self, db: AsyncSession, start_date=None, end_date=None) -> DashboardCardsSummary:
        """
        Executes aggregate queries for all 8 KPI performance metrics based on strict business rules:
        1. Total Sales = SUM(Sale.grand_total)
        2. Total Cash Sales = SUM(Sale.grand_total) WHERE Sale.due_amount <= 0
        3. Total Due Sales = SUM(Sale.grand_total) WHERE Sale.due_amount > 0
        4. Total Purchases = SUM(Purchase.grand_total)
        5. Total Expenses = SUM(Expense.amount)
        6. Customer Due = SUM(Customer.current_balance)
        7. Supplier Due = SUM(Supplier.current_balance)
        8. Total Profit = Total Sales - Total Purchases - Total Expenses
        """

        from app.services.setting_service import setting_service
        from app.core.datetime_utils import normalize_date_range
        from app.models.customer_collection import CustomerCollection
        from app.models.supplier_payment import SupplierPayment
        from app.models.sale_return import SaleReturn
        from app.models.product_return import ProductReturn
        from app.models.balance_adjustment import BalanceAdjustment
        from app.models.sale import SaleItem

        settings = await setting_service.get_business_settings(db)
        tz_str = settings.timezone or "UTC"
        start_date, end_date = normalize_date_range(start_date, end_date, tz_str=tz_str, default_to_today=True)

        # 1. Total Products Count (Active catalog)
        q_products = select(func.count(Product.id)).where(Product.status == "active")
        res_products = await db.execute(q_products)
        total_products = res_products.scalar() or 0

        # 2. Total Customers Count (Active catalog)
        q_customers = select(func.count(Customer.id))
        res_customers = await db.execute(q_customers)
        total_customers = res_customers.scalar() or 0

        # 3. Total Sales Amount (Gross sales turnover for current business date)
        q_sales = select(func.coalesce(func.sum(Sale.grand_total), 0.0))
        if start_date:
            q_sales = q_sales.where(Sale.sale_date >= start_date)
        if end_date:
            q_sales = q_sales.where(Sale.sale_date <= end_date)
        res_sales = await db.execute(q_sales)
        total_sales = float(res_sales.scalar() or 0.0)

        # 4. Total Cash / Paid Sales (Total collected paid amount on sales for current business date)
        q_cash_sales = select(func.coalesce(func.sum(Sale.paid_amount), 0.0))
        if start_date:
            q_cash_sales = q_cash_sales.where(Sale.sale_date >= start_date)
        if end_date:
            q_cash_sales = q_cash_sales.where(Sale.sale_date <= end_date)
        res_cash_sales = await db.execute(q_cash_sales)
        total_cash_sales = float(res_cash_sales.scalar() or 0.0)

        # 5. Total Due Sales (Total outstanding due on sales for current business date)
        q_due_sales = select(func.coalesce(func.sum(Sale.due_amount), 0.0))
        if start_date:
            q_due_sales = q_due_sales.where(Sale.sale_date >= start_date)
        if end_date:
            q_due_sales = q_due_sales.where(Sale.sale_date <= end_date)
        res_due_sales = await db.execute(q_due_sales)
        total_due_sales = float(res_due_sales.scalar() or 0.0)

        # 6. Total Purchases Amount (Procurement orders for current business date)
        q_purchases = select(func.coalesce(func.sum(Purchase.grand_total), 0.0))
        if start_date:
            q_purchases = q_purchases.where(Purchase.purchase_date >= start_date)
        if end_date:
            q_purchases = q_purchases.where(Purchase.purchase_date <= end_date)
        res_purchases = await db.execute(q_purchases)
        total_purchases = float(res_purchases.scalar() or 0.0)

        # 7. Total Expenses (Sum of all recorded expense entries for current business date)
        q_expenses = select(func.coalesce(func.sum(Expense.amount), 0.0))
        if start_date:
            q_expenses = q_expenses.where(Expense.expense_date >= start_date)
        if end_date:
            q_expenses = q_expenses.where(Expense.expense_date <= end_date)
        res_expenses = await db.execute(q_expenses)
        total_expenses = float(res_expenses.scalar() or 0.0)

        # 8. Customer Due: Outstanding customer balance as of end_date (balance-sheet snapshot)
        # Calculates outstanding receivables as of the selected end_date across all customers.
        # If end_date is in the past, rolls back transactions created after end_date from authoritative current_balance.
        # If end_date is today/future, transactions after end_date are 0, directly matching live current_balance.
        q_cust_after_sales = (
            select(Sale.customer_id, func.coalesce(func.sum(Sale.due_amount), 0.0).label("net_sales_due"))
            .where(Sale.sale_date > end_date)
            .group_by(Sale.customer_id)
            .subquery()
        )
        q_cust_after_cols = (
            select(CustomerCollection.customer_id, func.coalesce(func.sum(CustomerCollection.amount), 0.0).label("total_collected"))
            .where(CustomerCollection.collection_date > end_date)
            .group_by(CustomerCollection.customer_id)
            .subquery()
        )
        q_cust_after_rets = (
            select(SaleReturn.customer_id, func.coalesce(func.sum(SaleReturn.grand_total), 0.0).label("total_returned"))
            .where(SaleReturn.return_date > end_date)
            .group_by(SaleReturn.customer_id)
            .subquery()
        )
        q_cust_after_adjs = (
            select(BalanceAdjustment.entity_id.label("customer_id"), func.coalesce(func.sum(BalanceAdjustment.difference), 0.0).label("total_adj"))
            .where(BalanceAdjustment.entity_type == "customer", BalanceAdjustment.effective_date > end_date)
            .group_by(BalanceAdjustment.entity_id)
            .subquery()
        )

        cust_bal_expr = (
            Customer.current_balance
            - func.coalesce(q_cust_after_sales.c.net_sales_due, 0.0)
            + func.coalesce(q_cust_after_cols.c.total_collected, 0.0)
            + func.coalesce(q_cust_after_rets.c.total_returned, 0.0)
            - func.coalesce(q_cust_after_adjs.c.total_adj, 0.0)
        )

        q_customer_due = (
            select(func.coalesce(func.sum(case((cust_bal_expr > 0, cust_bal_expr), else_=0.0)), 0.0))
            .outerjoin(q_cust_after_sales, Customer.id == q_cust_after_sales.c.customer_id)
            .outerjoin(q_cust_after_cols, Customer.id == q_cust_after_cols.c.customer_id)
            .outerjoin(q_cust_after_rets, Customer.id == q_cust_after_rets.c.customer_id)
            .outerjoin(q_cust_after_adjs, Customer.id == q_cust_after_adjs.c.customer_id)
        )
        res_customer_due = await db.execute(q_customer_due)
        customer_due = round(float(res_customer_due.scalar() or 0.0), 2)

        # 9. Supplier Due: Outstanding supplier payable balance as of end_date (balance-sheet snapshot)
        # Calculates outstanding payables as of the selected end_date across all suppliers.
        # If end_date is in the past, rolls back transactions created after end_date from authoritative current_balance.
        # If end_date is today/future, transactions after end_date are 0, directly matching live current_balance.
        q_supp_after_purch = (
            select(Purchase.supplier_id, func.coalesce(func.sum(Purchase.due_amount), 0.0).label("net_purch_due"))
            .where(Purchase.purchase_date > end_date)
            .group_by(Purchase.supplier_id)
            .subquery()
        )
        q_supp_after_pays = (
            select(SupplierPayment.supplier_id, func.coalesce(func.sum(SupplierPayment.amount), 0.0).label("total_paid"))
            .where(SupplierPayment.payment_date > end_date)
            .group_by(SupplierPayment.supplier_id)
            .subquery()
        )
        q_supp_after_rets = (
            select(ProductReturn.supplier_id, func.coalesce(func.sum(ProductReturn.grand_total - ProductReturn.refund_received), 0.0).label("net_returned"))
            .where(ProductReturn.return_date > end_date)
            .group_by(ProductReturn.supplier_id)
            .subquery()
        )
        q_supp_after_adjs = (
            select(BalanceAdjustment.entity_id.label("supplier_id"), func.coalesce(func.sum(BalanceAdjustment.difference), 0.0).label("total_adj"))
            .where(BalanceAdjustment.entity_type == "supplier", BalanceAdjustment.effective_date > end_date)
            .group_by(BalanceAdjustment.entity_id)
            .subquery()
        )

        supp_bal_expr = (
            Supplier.current_balance
            - func.coalesce(q_supp_after_purch.c.net_purch_due, 0.0)
            + func.coalesce(q_supp_after_pays.c.total_paid, 0.0)
            + func.coalesce(q_supp_after_rets.c.net_returned, 0.0)
            - func.coalesce(q_supp_after_adjs.c.total_adj, 0.0)
        )

        q_supplier_due = (
            select(func.coalesce(func.sum(case((supp_bal_expr > 0, supp_bal_expr), else_=0.0)), 0.0))
            .outerjoin(q_supp_after_purch, Supplier.id == q_supp_after_purch.c.supplier_id)
            .outerjoin(q_supp_after_pays, Supplier.id == q_supp_after_pays.c.supplier_id)
            .outerjoin(q_supp_after_rets, Supplier.id == q_supp_after_rets.c.supplier_id)
            .outerjoin(q_supp_after_adjs, Supplier.id == q_supp_after_adjs.c.supplier_id)
        )
        res_supplier_due = await db.execute(q_supplier_due)
        supplier_due = round(float(res_supplier_due.scalar() or 0.0), 2)

        # 10. Total Units Sold (Total units sold in current business date)
        q_units = select(func.coalesce(func.sum(SaleItem.quantity), 0.0)).join(Sale)
        if start_date:
            q_units = q_units.where(Sale.sale_date >= start_date)
        if end_date:
            q_units = q_units.where(Sale.sale_date <= end_date)
        res_units = await db.execute(q_units)
        total_units_sold = float(res_units.scalar() or 0.0)

        # 11. Total COGS (Cost of Goods Sold based on actual inventory cost layers consumed by today's sales)
        q_cogs = select(func.coalesce(func.sum(SaleItem.cogs), 0.0)).join(Sale)
        if start_date:
            q_cogs = q_cogs.where(Sale.sale_date >= start_date)
        if end_date:
            q_cogs = q_cogs.where(Sale.sale_date <= end_date)
        res_cogs = await db.execute(q_cogs)
        total_cogs = float(res_cogs.scalar() or 0.0)

        # 12. Total Profit = Total Sales - Total COGS - Total Expenses
        total_profit = round(total_sales - total_cogs - total_expenses, 2)

        return DashboardCardsSummary(
            total_products=total_products,
            total_customers=total_customers,
            total_sales=round(total_sales, 2),
            total_cash_sales=round(total_cash_sales, 2),
            total_due_sales=round(total_due_sales, 2),
            total_purchases=round(total_purchases, 2),
            total_expenses=round(total_expenses, 2),
            customer_due=customer_due,
            supplier_due=supplier_due,
            total_profit=total_profit,
            total_due=round(total_due_sales, 2),
            total_units_sold=round(total_units_sold, 2),
            total_cogs=round(total_cogs, 2),
        )


    async def get_recent_sales(self, db: AsyncSession, limit: int = 10) -> List[RecentSaleItem]:
        """Fetches the latest sales transactions."""
        query = (
            select(Sale)
            .options(selectinload(Sale.customer))
            .order_by(Sale.sale_date.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        sales = result.scalars().all()

        return [
            RecentSaleItem(
                id=sale.id,
                invoice_no=sale.invoice_no,
                customer_name=sale.customer.name if sale.customer else "Walk-in Customer",
                grand_total=sale.grand_total,
                sale_date=sale.sale_date,
            )
            for sale in sales
        ]

    async def get_low_stock_products(self, db: AsyncSession, limit: int = 10) -> List[LowStockProductItem]:
        """Fetches products whose current_stock is <= minimum_stock level."""
        query = (
            select(Product)
            .where(Product.current_stock <= Product.minimum_stock, Product.status == "active")
            .order_by((Product.current_stock - Product.minimum_stock).asc())
            .limit(limit)
        )
        result = await db.execute(query)
        products = result.scalars().all()

        return [
            LowStockProductItem(
                id=p.id,
                product_code=p.product_code,
                name=p.name,
                unit=p.unit,
                current_stock=p.current_stock,
                minimum_stock=p.minimum_stock,
            )
            for p in products
        ]


dashboard_service = DashboardService()
