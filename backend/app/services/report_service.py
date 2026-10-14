import zoneinfo
from datetime import datetime, time, timezone
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.product import Product
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.repositories.product_repository import product_repository
from app.repositories.setting_repository import setting_repository
from app.repositories.customer_repository import customer_repository
from app.schemas.report import (
    ConfiguredCustomerInfo,
    DailyStockReportResponse,
    StockMovementItem,
    StockReportProductInfo,
)


class ReportService:
    async def get_daily_stock_report(
        self,
        db: AsyncSession,
        product_id: str,
        target_date_str: str,
        client_tz_str: Optional[str] = None,
    ) -> DailyStockReportResponse:
        """
        Calculates daily product stock summary and movements for a given product and date.
        Respects historical ledger balances (does not rely on current_stock for past dates).
        If a dedicated customer is configured in Settings, that customer's sales quantity
        is separated into customer_sales and excluded from cash_sales and due_sales.
        """
        product = await product_repository.get_by_id(db, id=product_id)
        if not product:
            raise NotFoundException(f"Product with ID '{product_id}' not found.")

        # Determine timezone (client param -> business setting -> UTC)
        tz_name = client_tz_str
        if not tz_name:
            setting = await setting_repository.get_by_key(db, "timezone")
            tz_name = setting.value if setting and setting.value else "UTC"

        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
            tz_name = "UTC"

        # Parse target date
        try:
            parsed_date = datetime.strptime(target_date_str.strip(), "%Y-%m-%d").date()
        except (ValueError, AttributeError):
            raise BadRequestException("Invalid date format. Expected YYYY-MM-DD.")

        # Construct exact start and end of day in the configured timezone, converted to UTC
        start_local = datetime.combine(parsed_date, time.min).replace(tzinfo=tz)
        end_local = datetime.combine(parsed_date, time.max).replace(tzinfo=tz)
        start_utc = start_local.astimezone(timezone.utc)
        end_utc = end_local.astimezone(timezone.utc)

        # Retrieve dedicated customer setting if configured
        cust_setting = await setting_repository.get_by_key(db, "stock_report_customer_id")
        configured_customer_id = (
            cust_setting.value.strip()
            if cust_setting and cust_setting.value and cust_setting.value.strip()
            else None
        )

        configured_customer_info = None
        if configured_customer_id:
            cust_obj = await customer_repository.get_by_id(db, id=configured_customer_id)
            if cust_obj:
                configured_customer_info = ConfiguredCustomerInfo(
                    id=cust_obj.id,
                    name=cust_obj.name,
                    customer_code=cust_obj.customer_code,
                )
            else:
                configured_customer_id = None

        # 1. Prior Movements (Strictly before start_utc) to compute Opening Stock
        prior_purchases = (
            await db.execute(
                select(func.coalesce(func.sum(PurchaseItem.quantity), 0.0))
                .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
                .where(
                    PurchaseItem.product_id == product_id,
                    Purchase.purchase_date < start_utc,
                )
            )
        ).scalar_one()

        prior_purch_returns = (
            await db.execute(
                select(func.coalesce(func.sum(ProductReturnItem.quantity), 0.0))
                .join(ProductReturn, ProductReturnItem.product_return_id == ProductReturn.id)
                .where(
                    ProductReturnItem.product_id == product_id,
                    ProductReturn.return_date < start_utc,
                )
            )
        ).scalar_one()

        prior_sales = (
            await db.execute(
                select(func.coalesce(func.sum(SaleItem.quantity), 0.0))
                .join(Sale, SaleItem.sale_id == Sale.id)
                .where(
                    SaleItem.product_id == product_id,
                    Sale.sale_date < start_utc,
                )
            )
        ).scalar_one()

        prior_sale_returns = (
            await db.execute(
                select(func.coalesce(func.sum(SaleReturnItem.quantity), 0.0))
                .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
                .where(
                    SaleReturnItem.product_id == product_id,
                    SaleReturn.return_date < start_utc,
                )
            )
        ).scalar_one()

        opening_stock = (
            float(product.opening_stock)
            + float(prior_purchases)
            - float(prior_purch_returns)
            - float(prior_sales)
            + float(prior_sale_returns)
        )

        # 2. Query Day's Transactions (Within [start_utc, end_utc])
        purchases_res = (
            await db.execute(
                select(PurchaseItem, Purchase)
                .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
                .where(
                    PurchaseItem.product_id == product_id,
                    Purchase.purchase_date >= start_utc,
                    Purchase.purchase_date <= end_utc,
                )
                .order_by(Purchase.purchase_date.asc(), PurchaseItem.id.asc())
            )
        ).all()

        pret_res = (
            await db.execute(
                select(ProductReturnItem, ProductReturn)
                .join(ProductReturn, ProductReturnItem.product_return_id == ProductReturn.id)
                .where(
                    ProductReturnItem.product_id == product_id,
                    ProductReturn.return_date >= start_utc,
                    ProductReturn.return_date <= end_utc,
                )
                .order_by(ProductReturn.return_date.asc(), ProductReturnItem.id.asc())
            )
        ).all()

        sales_res = (
            await db.execute(
                select(SaleItem, Sale)
                .join(Sale, SaleItem.sale_id == Sale.id)
                .where(
                    SaleItem.product_id == product_id,
                    Sale.sale_date >= start_utc,
                    Sale.sale_date <= end_utc,
                )
                .order_by(Sale.sale_date.asc(), SaleItem.id.asc())
            )
        ).all()

        sret_res = (
            await db.execute(
                select(SaleReturnItem, SaleReturn)
                .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
                .where(
                    SaleReturnItem.product_id == product_id,
                    SaleReturn.return_date >= start_utc,
                    SaleReturn.return_date <= end_utc,
                )
                .order_by(SaleReturn.return_date.asc(), SaleReturnItem.id.asc())
            )
        ).all()

        # 3. Calculate Day's Aggregations & Movements
        raw_movements = []

        day_purchases = 0.0
        for pi, p in purchases_res:
            qty = float(pi.quantity)
            day_purchases += qty
            raw_movements.append({
                "id": pi.id,
                "timestamp": p.purchase_date,
                "type": "purchase",
                "type_label": "Purchase",
                "reference_no": p.purchase_no,
                "party_name": p.supplier.name if p.supplier else "Supplier",
                "in_out": "IN",
                "quantity": qty,
                "unit_price": float(pi.unit_price),
                "total_price": float(pi.total_price),
                "cash_quantity": 0.0,
                "due_quantity": 0.0,
                "payment_status": p.payment_status,
            })

        day_purch_returns = 0.0
        for pri, pr in pret_res:
            qty = float(pri.quantity)
            day_purch_returns += qty
            raw_movements.append({
                "id": pri.id,
                "timestamp": pr.return_date,
                "type": "purchase_return",
                "type_label": "Purchase Return",
                "reference_no": pr.return_no,
                "party_name": pr.supplier.name if pr.supplier else "Supplier",
                "in_out": "OUT",
                "quantity": qty,
                "unit_price": float(pri.unit_price),
                "total_price": float(pri.total_price),
                "cash_quantity": 0.0,
                "due_quantity": 0.0,
                "payment_status": None,
            })

        day_sales = 0.0
        day_cash_sales = 0.0
        day_due_sales = 0.0
        day_customer_sales = 0.0

        for si, s in sales_res:
            qty = float(si.quantity)
            day_sales += qty

            # Check if this sale belongs to the configured dedicated customer
            if configured_customer_id and s.customer_id == configured_customer_id:
                day_customer_sales += qty
                c_qty = 0.0
                d_qty = 0.0
            else:
                if s.grand_total > 0:
                    cash_ratio = min(1.0, max(0.0, float(s.paid_amount) / float(s.grand_total)))
                else:
                    cash_ratio = 1.0 if s.paid_amount > 0 else 0.0
                due_ratio = 1.0 - cash_ratio

                c_qty = qty * cash_ratio
                d_qty = qty * due_ratio
                day_cash_sales += c_qty
                day_due_sales += d_qty

            raw_movements.append({
                "id": si.id,
                "timestamp": s.sale_date,
                "type": "sale",
                "type_label": "Sale",
                "reference_no": s.invoice_no,
                "party_name": s.customer.name if s.customer else "Walk-in Customer",
                "in_out": "OUT",
                "quantity": qty,
                "unit_price": float(si.unit_price),
                "total_price": float(si.total_price),
                "cash_quantity": round(c_qty, 4),
                "due_quantity": round(d_qty, 4),
                "payment_status": s.payment_status,
            })

        day_sale_returns = 0.0
        for sri, sr in sret_res:
            qty = float(sri.quantity)
            day_sale_returns += qty
            raw_movements.append({
                "id": sri.id,
                "timestamp": sr.return_date,
                "type": "sale_return",
                "type_label": "Sale Return",
                "reference_no": sr.return_no,
                "party_name": sr.customer.name if sr.customer else "Customer",
                "in_out": "IN",
                "quantity": qty,
                "unit_price": float(sri.unit_price),
                "total_price": float(sri.total_price),
                "cash_quantity": 0.0,
                "due_quantity": 0.0,
                "payment_status": None,
            })

        # Sort movements chronologically
        raw_movements.sort(key=lambda m: (m["timestamp"], m["id"]))

        # Calculate Running Balance for the day
        current_running = opening_stock
        movements: list[StockMovementItem] = []
        for m in raw_movements:
            if m["in_out"] == "IN":
                current_running += m["quantity"]
            else:
                current_running -= m["quantity"]
            m["running_stock"] = round(current_running, 4)
            movements.append(StockMovementItem(**m))

        remaining_stock = (
            opening_stock
            + day_purchases
            - day_purch_returns
            - day_sales
            + day_sale_returns
        )

        product_info = StockReportProductInfo(
            id=product.id,
            name=product.name,
            product_code=product.product_code,
            unit=product.unit,
            category=product.category,
            brand=product.brand,
            barcode=product.barcode,
            selling_price=float(product.selling_price),
            current_stock=float(product.current_stock),
        )

        return DailyStockReportResponse(
            product=product_info,
            target_date=target_date_str.strip(),
            timezone=tz_name,
            opening_stock=round(opening_stock, 4),
            purchases=round(day_purchases, 4),
            sales=round(day_sales, 4),
            cash_sales=round(day_cash_sales, 4),
            due_sales=round(day_due_sales, 4),
            customer_sales=round(day_customer_sales, 4),
            configured_customer=configured_customer_info,
            purchase_returns=round(day_purch_returns, 4),
            sale_returns=round(day_sale_returns, 4),
            remaining_stock=round(remaining_stock, 4),
            movements=movements,
        )


report_service = ReportService()
