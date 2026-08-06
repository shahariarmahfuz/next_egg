from typing import List
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Customer, Expense, Product, Purchase, Sale, Supplier, User
from app.schemas.dashboard import (
    DashboardCardsSummary,
    LowStockProductItem,
    RecentSaleItem,
)


class DashboardService:
    async def get_dashboard_summary(self, db: AsyncSession) -> DashboardCardsSummary:
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

        # 1. Total Products Count
        q_products = select(func.count(Product.id)).where(Product.status == "active")
        res_products = await db.execute(q_products)
        total_products = res_products.scalar() or 0

        # 2. Total Customers Count
        q_customers = select(func.count(Customer.id))
        res_customers = await db.execute(q_customers)
        total_customers = res_customers.scalar() or 0

        # 3. Total Sales Amount (All sales invoices: Cash + Credit)
        q_sales = select(func.coalesce(func.sum(Sale.grand_total), 0.0))
        res_sales = await db.execute(q_sales)
        total_sales = float(res_sales.scalar() or 0.0)

        # 4. Total Cash Sales (Sales where Due Amount = 0)
        q_cash_sales = select(func.coalesce(func.sum(Sale.grand_total), 0.0)).where(
            Sale.due_amount <= 0.0
        )
        res_cash_sales = await db.execute(q_cash_sales)
        total_cash_sales = float(res_cash_sales.scalar() or 0.0)

        # 5. Total Due Sales (Sales where Due Amount > 0)
        q_due_sales = select(func.coalesce(func.sum(Sale.grand_total), 0.0)).where(
            Sale.due_amount > 0.0
        )
        res_due_sales = await db.execute(q_due_sales)
        total_due_sales = float(res_due_sales.scalar() or 0.0)

        # 6. Total Purchases Amount (All purchase invoices)
        q_purchases = select(func.coalesce(func.sum(Purchase.grand_total), 0.0))
        res_purchases = await db.execute(q_purchases)
        total_purchases = float(res_purchases.scalar() or 0.0)

        # 7. Total Expenses (Sum of all recorded expense entries)
        q_expenses = select(func.coalesce(func.sum(Expense.amount), 0.0))
        res_expenses = await db.execute(q_expenses)
        total_expenses = float(res_expenses.scalar() or 0.0)

        # 8. Customer Total Dues (Total outstanding receivable from customers)
        q_cust_due = select(func.coalesce(func.sum(Customer.current_balance), 0.0))
        res_cust_due = await db.execute(q_cust_due)
        customer_due = float(res_cust_due.scalar() or 0.0)

        # 9. Supplier Total Dues (Total outstanding payable to suppliers)
        q_supp_due = select(func.coalesce(func.sum(Supplier.current_balance), 0.0))
        res_supp_due = await db.execute(q_supp_due)
        supplier_due = float(res_supp_due.scalar() or 0.0)

        # 10. Total COGS (Cost of Goods Sold based on actual batches)
        from app.models.sale import SaleItem
        q_cogs = select(func.coalesce(func.sum(SaleItem.cogs), 0.0))
        res_cogs = await db.execute(q_cogs)
        total_cogs = float(res_cogs.scalar() or 0.0)

        # 11. Total Profit = Total Sales - Total COGS - Total Expenses
        total_profit = round(total_sales - total_cogs - total_expenses, 2)

        return DashboardCardsSummary(
            total_products=total_products,
            total_customers=total_customers,
            total_sales=round(total_sales, 2),
            total_cash_sales=round(total_cash_sales, 2),
            total_due_sales=round(total_due_sales, 2),
            total_purchases=round(total_purchases, 2),
            total_expenses=round(total_expenses, 2),
            customer_due=round(customer_due, 2),
            supplier_due=round(supplier_due, 2),
            total_profit=total_profit,
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
