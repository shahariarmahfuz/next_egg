import zoneinfo
from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.product import Product
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.models.customer_collection import CustomerCollection
from app.models.cash_out import CashOut
from app.models.expense import Expense, ExpenseCategory
from app.repositories.product_repository import product_repository
from app.repositories.setting_repository import setting_repository
from app.repositories.customer_repository import customer_repository
from app.services.setting_service import setting_service
from app.schemas.report import (
    ConfiguredCustomerInfo,
    DailyStockReportResponse,
    StockMovementItem,
    StockReportProductInfo,
    CashSaleReportItem,
    CustomerCollectionReportItem,
    CashOutReportItem,
    CashOutReasonBreakdown,
    CashOutReportSummary,
    CashOutReportResponse,
    ExpenseReportItem,
    CashReportBreakdown,
    DailyCashReportResponse,
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
        if not tz_name or tz_name == "UTC":
            setting = await setting_repository.get_by_key(db, "timezone")
            if setting and setting.value and setting.value != "UTC":
                tz_name = setting.value
            elif not tz_name:
                tz_name = "UTC"

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

        # 1. Query Day's Transactions (Within [start_utc, end_utc])
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

            # Check if this sale belongs to the configured dedicated customer
            if configured_customer_id and s.customer_id == configured_customer_id:
                day_customer_sales += qty
                c_qty = 0.0
                d_qty = 0.0
            else:
                day_sales += qty
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

        # 2. Determine End-of-Day Remaining Stock (Anchored to authoritative product.current_stock)
        now_utc = datetime.now(timezone.utc)
        live_current_stock = float(product.current_stock)

        if end_utc < now_utc:
            # Target date is in the past: reverse all transactions after end_utc
            after_purchases = (
                await db.execute(
                    select(func.coalesce(func.sum(PurchaseItem.quantity), 0.0))
                    .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
                    .where(
                        PurchaseItem.product_id == product_id,
                        Purchase.purchase_date > end_utc,
                    )
                )
            ).scalar_one()

            after_purch_returns = (
                await db.execute(
                    select(func.coalesce(func.sum(ProductReturnItem.quantity), 0.0))
                    .join(ProductReturn, ProductReturnItem.product_return_id == ProductReturn.id)
                    .where(
                        ProductReturnItem.product_id == product_id,
                        ProductReturn.return_date > end_utc,
                    )
                )
            ).scalar_one()

            after_sales = (
                await db.execute(
                    select(func.coalesce(func.sum(SaleItem.quantity), 0.0))
                    .join(Sale, SaleItem.sale_id == Sale.id)
                    .where(
                        SaleItem.product_id == product_id,
                        Sale.sale_date > end_utc,
                    )
                )
            ).scalar_one()

            after_sale_returns = (
                await db.execute(
                    select(func.coalesce(func.sum(SaleReturnItem.quantity), 0.0))
                    .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
                    .where(
                        SaleReturnItem.product_id == product_id,
                        SaleReturn.return_date > end_utc,
                    )
                )
            ).scalar_one()

            after_net_inflow = (float(after_purchases) - float(after_purch_returns)) + float(after_sale_returns)
            after_net_outflow = float(after_sales)
            end_of_day_stock = live_current_stock - after_net_inflow + after_net_outflow
        else:
            # Target date is Today (or future): remaining stock at end of target date matches live current stock
            end_of_day_stock = live_current_stock

        if abs(end_of_day_stock) < 1e-6:
            end_of_day_stock = 0.0

        # Physical remaining stock after all sales (regular sales + tracked customer sales)
        final_remaining_stock = end_of_day_stock

        # Remaining stock after regular sales (before tracked customer deduction)
        remaining_stock = round(final_remaining_stock + day_customer_sales, 4)

        # Day's net inflow from purchases and returns
        day_net_inflow = (day_purchases - day_purch_returns) + day_sale_returns

        # Previous Stock (start of day balance):
        # Previous Stock + Day Net Inflow - Day Regular Sales = Remaining Stock
        previous_stock = round(remaining_stock - day_net_inflow + day_sales, 4)

        if abs(remaining_stock) < 1e-6:
            remaining_stock = 0.0
        if abs(previous_stock) < 1e-6:
            previous_stock = 0.0
        if abs(final_remaining_stock) < 1e-6:
            final_remaining_stock = 0.0

        total_stock = round(previous_stock + day_purchases, 4)
        if abs(total_stock) < 1e-6:
            total_stock = 0.0

        # Sort movements chronologically
        raw_movements.sort(key=lambda m: (m["timestamp"], m["id"]))

        # Calculate Running Balance for the day starting from previous_stock
        current_running = previous_stock
        movements: list[StockMovementItem] = []
        for m in raw_movements:
            if m["in_out"] == "IN":
                current_running += m["quantity"]
            else:
                current_running -= m["quantity"]
            m["running_stock"] = round(current_running, 4)
            movements.append(StockMovementItem(**m))

        product_info = StockReportProductInfo(
            id=product.id,
            name=product.name,
            product_code=product.product_code,
            unit=product.unit,
            category=product.category,
            brand=product.brand,
            barcode=product.barcode,
            selling_price=float(product.selling_price),
            current_stock=live_current_stock,
        )

        return DailyStockReportResponse(
            product=product_info,
            target_date=target_date_str.strip(),
            timezone=tz_name,
            opening_stock=round(previous_stock, 4),
            previous_stock=round(previous_stock, 4),
            purchases=round(day_purchases, 4),
            total_stock=round(total_stock, 4),
            sales=round(day_sales, 4),
            cash_sales=round(day_cash_sales, 4),
            due_sales=round(day_due_sales, 4),
            customer_sales=round(day_customer_sales, 4),
            tracked_customer_qty=round(day_customer_sales, 4),
            configured_customer=configured_customer_info,
            purchase_returns=round(day_purch_returns, 4),
            sale_returns=round(day_sale_returns, 4),
            remaining_stock=round(remaining_stock, 4),
            final_remaining_stock=round(final_remaining_stock, 4),
            movements=movements,
        )

    async def get_daily_cash_report(
        self,
        db: AsyncSession,
        target_date_str: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None,
        client_tz_str: Optional[str] = None,
    ) -> DailyCashReportResponse:
        """
        Calculates daily cash summary and itemized breakdown:
        - Cash Inflow: Cash Sales (paid_amount > 0) + Customer Collections
        - Cash Outflow: Cash Outs (physical cash withdrawal) + Expenses
        - Net Remaining Cash: Cash In - Cash Out (Decimal precision)
        """
        # Fetch business configuration (Timezone, Business Profile)
        business_settings = await setting_service.get_business_settings(db)
        tz_name = client_tz_str or business_settings.timezone or "Asia/Dhaka"

        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
            tz_name = "UTC"

        # Determine target date boundaries
        if start_date_str and end_date_str:
            try:
                start_d = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                end_d = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
            except (ValueError, AttributeError):
                raise BadRequestException("Invalid date range format. Expected YYYY-MM-DD.")
        elif target_date_str:
            try:
                start_d = datetime.strptime(target_date_str.strip(), "%Y-%m-%d").date()
                end_d = start_d
            except (ValueError, AttributeError):
                raise BadRequestException("Invalid date format. Expected YYYY-MM-DD.")
        else:
            # Default to today in business timezone
            now_tz = datetime.now(tz)
            start_d = now_tz.date()
            end_d = start_d

        if start_d > end_d:
            raise BadRequestException("start_date cannot be after end_date.")

        # Construct exact start and end of day in the configured timezone, converted to UTC
        start_local = datetime.combine(start_d, time.min).replace(tzinfo=tz)
        end_local = datetime.combine(end_d, time.max).replace(tzinfo=tz)
        start_utc = start_local.astimezone(timezone.utc)
        end_utc = end_local.astimezone(timezone.utc)

        display_date = (
            start_d.strftime("%Y-%m-%d")
            if start_d == end_d
            else f"{start_d.strftime('%Y-%m-%d')} to {end_d.strftime('%Y-%m-%d')}"
        )

        breakdown = CashReportBreakdown()

        # 1. Cash Sales (paid_amount > 0)
        q_sales = (
            select(Sale)
            .options(selectinload(Sale.customer))
            .where(
                Sale.sale_date >= start_utc,
                Sale.sale_date <= end_utc,
                Sale.paid_amount > 0,
            )
            .order_by(Sale.sale_date.asc(), Sale.invoice_no.asc())
        )
        sales_records = (await db.execute(q_sales)).scalars().all()
        cash_sales_dec = Decimal("0.00")
        for s in sales_records:
            paid_dec = Decimal(str(s.paid_amount))
            cash_sales_dec += paid_dec
            cust_name = s.customer.name if s.customer else "Walk-in Customer"
            cust_code = s.customer.customer_code if s.customer else None
            breakdown.cash_sales.append(
                CashSaleReportItem(
                    id=str(s.id),
                    invoice_no=s.invoice_no,
                    sale_date=s.sale_date,
                    customer_id=str(s.customer_id),
                    customer_name=cust_name,
                    customer_code=cust_code,
                    grand_total=float(s.grand_total),
                    paid_amount=float(s.paid_amount),
                    due_amount=float(s.due_amount),
                    payment_status=s.payment_status,
                    notes=s.notes,
                )
            )

        # 2. Customer Collections (amount > 0)
        q_cols = (
            select(CustomerCollection)
            .options(selectinload(CustomerCollection.customer))
            .where(
                CustomerCollection.collection_date >= start_utc,
                CustomerCollection.collection_date <= end_utc,
                CustomerCollection.amount > 0,
            )
            .order_by(CustomerCollection.collection_date.asc(), CustomerCollection.collection_no.asc())
        )
        col_records = (await db.execute(q_cols)).scalars().all()
        collections_dec = Decimal("0.00")
        for c in col_records:
            col_dec = Decimal(str(c.amount))
            collections_dec += col_dec
            cust_name = c.customer.name if c.customer else "Customer"
            cust_code = c.customer.customer_code if c.customer else None
            breakdown.customer_collections.append(
                CustomerCollectionReportItem(
                    id=str(c.id),
                    collection_no=c.collection_no,
                    collection_date=c.collection_date,
                    customer_id=str(c.customer_id),
                    customer_name=cust_name,
                    customer_code=cust_code,
                    amount=float(c.amount),
                    payment_method=c.payment_method,
                    reference_no=c.reference_no,
                    notes=c.notes,
                )
            )

        # 3. Cash Outs (physical cash withdrawal, amount > 0)
        q_cash_outs = (
            select(CashOut)
            .options(selectinload(CashOut.created_by))
            .where(
                CashOut.cash_out_date >= start_utc,
                CashOut.cash_out_date <= end_utc,
                CashOut.amount > 0,
            )
            .order_by(CashOut.cash_out_date.asc(), CashOut.cash_out_no.asc())
        )
        cash_out_records = (await db.execute(q_cash_outs)).scalars().all()
        cash_outs_dec = Decimal("0.00")
        for co in cash_out_records:
            co_dec = Decimal(str(co.amount))
            cash_outs_dec += co_dec
            creator_name = (
                getattr(co.created_by, "full_name", None)
                or getattr(co.created_by, "username", None)
                if co.created_by
                else None
            )
            breakdown.cash_outs.append(
                CashOutReportItem(
                    id=str(co.id),
                    cash_out_no=co.cash_out_no,
                    cash_out_date=co.cash_out_date,
                    amount=float(co.amount),
                    reason=co.reason,
                    notes=co.notes,
                    created_by_name=creator_name,
                )
            )

        # 4. Expenses (amount > 0)
        q_expenses = (
            select(Expense)
            .options(selectinload(Expense.category), selectinload(Expense.created_by))
            .where(
                Expense.expense_date >= start_utc,
                Expense.expense_date <= end_utc,
                Expense.amount > 0,
            )
            .order_by(Expense.expense_date.asc(), Expense.voucher_no.asc())
        )
        expense_records = (await db.execute(q_expenses)).scalars().all()
        expenses_dec = Decimal("0.00")
        for exp in expense_records:
            exp_dec = Decimal(str(exp.amount))
            expenses_dec += exp_dec
            cat_name = exp.category.name if exp.category else "Expense"
            creator_name = (
                getattr(exp.created_by, "full_name", None)
                or getattr(exp.created_by, "username", None)
                if exp.created_by
                else None
            )
            breakdown.expenses.append(
                ExpenseReportItem(
                    id=str(exp.id),
                    voucher_no=exp.voucher_no,
                    expense_date=exp.expense_date,
                    category_id=str(exp.category_id),
                    category_name=cat_name,
                    amount=float(exp.amount),
                    payment_method=exp.payment_method,
                    reference_no=exp.reference_no,
                    description=exp.description,
                    created_by_name=creator_name,
                )
            )

        # 5. Totals & Net Remaining Cash
        total_cash_in_dec = cash_sales_dec + collections_dec
        total_cash_out_dec = cash_outs_dec + expenses_dec
        remaining_cash_dec = total_cash_in_dec - total_cash_out_dec

        return DailyCashReportResponse(
            target_date=display_date,
            start_date=start_d.strftime("%Y-%m-%d"),
            end_date=end_d.strftime("%Y-%m-%d"),
            timezone=tz_name,
            cash_sales_amount=float(cash_sales_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            customer_collections_amount=float(collections_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            total_cash_in=float(total_cash_in_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            cash_out_amount=float(cash_outs_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            expenses_amount=float(expenses_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            total_cash_out=float(total_cash_out_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            remaining_cash=float(remaining_cash_dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            company_name=business_settings.business_name,
            company_address=business_settings.business_address,
            company_phone=business_settings.business_phone,
            company_logo=business_settings.business_logo,
            breakdown=breakdown,
        )

    async def get_cash_out_report(
        self,
        db: AsyncSession,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None,
        search: Optional[str] = None,
        reason: Optional[str] = None,
        created_by_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        client_tz_str: Optional[str] = None,
    ) -> CashOutReportResponse:
        """
        Standalone Cash Out Report:
        - Date range filtering (with timezone conversion to UTC)
        - Search query over cash_out_no, reason, and notes
        - Category/Reason and Creator user filters
        - Summary metrics: total_cash_outs, total_amount, average_amount, top_reason, top_reason_amount
        - Breakdown by reason/category with count, total_amount, percentage
        - Paginated or itemized records with creator name
        """
        business_settings = await setting_service.get_business_settings(db)
        tz_name = client_tz_str or business_settings.timezone or "Asia/Dhaka"

        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
            tz_name = "UTC"

        now_tz = datetime.now(tz)
        if start_date_str and end_date_str:
            try:
                start_d = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                end_d = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
            except (ValueError, AttributeError):
                raise BadRequestException("Invalid date range format. Expected YYYY-MM-DD.")
        elif start_date_str:
            try:
                start_d = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                end_d = start_d
            except (ValueError, AttributeError):
                raise BadRequestException("Invalid date format. Expected YYYY-MM-DD.")
        else:
            start_d = now_tz.date()
            end_d = start_d

        if start_d > end_d:
            raise BadRequestException("start_date cannot be after end_date.")

        start_local = datetime.combine(start_d, time.min).replace(tzinfo=tz)
        end_local = datetime.combine(end_d, time.max).replace(tzinfo=tz)
        start_utc = start_local.astimezone(timezone.utc)
        end_utc = end_local.astimezone(timezone.utc)

        # Build base filter conditions
        conditions = [
            CashOut.cash_out_date >= start_utc,
            CashOut.cash_out_date <= end_utc,
        ]

        if search and search.strip():
            pat = f"%{search.strip()}%"
            conditions.append(
                or_(
                    CashOut.cash_out_no.ilike(pat),
                    CashOut.reason.ilike(pat),
                    CashOut.notes.ilike(pat),
                )
            )

        if reason and reason.strip() and reason.strip().lower() != "all":
            conditions.append(CashOut.reason == reason.strip())

        if created_by_id and created_by_id.strip() and created_by_id.strip().lower() != "all":
            conditions.append(CashOut.created_by_id == created_by_id.strip())

        # 1. Total Count & Total Amount
        summary_query = select(
            func.count(CashOut.id),
            func.coalesce(func.sum(CashOut.amount), 0.0),
        ).where(*conditions)
        summary_res = await db.execute(summary_query)
        total_count, total_amount_raw = summary_res.first() or (0, 0.0)

        total_amount_dec = Decimal(str(total_amount_raw or 0.0)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        total_amount = float(total_amount_dec)
        avg_amount = round(total_amount / total_count, 2) if total_count > 0 else 0.0

        # 2. Reason / Category Breakdown
        breakdown_query = (
            select(
                CashOut.reason,
                func.count(CashOut.id).label("count"),
                func.coalesce(func.sum(CashOut.amount), 0.0).label("total_amount"),
            )
            .where(*conditions)
            .group_by(CashOut.reason)
            .order_by(desc("total_amount"))
        )
        breakdown_res = await db.execute(breakdown_query)
        reasons_breakdown: List[CashOutReasonBreakdown] = []
        top_reason: Optional[str] = None
        top_reason_amount: float = 0.0

        for r_reason, r_count, r_amount_raw in breakdown_res.all():
            r_dec = Decimal(str(r_amount_raw or 0.0)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            r_amount = float(r_dec)
            pct = round((r_amount / total_amount * 100), 1) if total_amount > 0 else 0.0
            reasons_breakdown.append(
                CashOutReasonBreakdown(
                    reason=r_reason,
                    count=r_count,
                    total_amount=r_amount,
                    percentage=pct,
                )
            )

        if reasons_breakdown:
            top_reason = reasons_breakdown[0].reason
            top_reason_amount = reasons_breakdown[0].total_amount

        # 3. Itemized List
        limit = max(1, min(page_size, 500))
        offset = (max(1, page) - 1) * limit
        items_query = (
            select(CashOut)
            .options(selectinload(CashOut.created_by))
            .where(*conditions)
            .order_by(CashOut.cash_out_date.desc(), CashOut.cash_out_no.desc())
            .offset(offset)
            .limit(limit)
        )
        items_res = (await db.execute(items_query)).scalars().all()

        items: List[CashOutReportItem] = []
        for co in items_res:
            creator_name = (
                getattr(co.created_by, "full_name", None)
                or getattr(co.created_by, "username", None)
                if co.created_by
                else None
            )
            items.append(
                CashOutReportItem(
                    id=str(co.id),
                    cash_out_no=co.cash_out_no,
                    cash_out_date=co.cash_out_date,
                    amount=float(co.amount),
                    reason=co.reason,
                    category=co.reason,
                    notes=co.notes,
                    created_by_id=str(co.created_by_id),
                    created_by_name=creator_name,
                    status="completed",
                )
            )

        summary = CashOutReportSummary(
            total_cash_outs=total_count,
            total_amount=total_amount,
            average_amount=avg_amount,
            top_reason=top_reason,
            top_reason_amount=top_reason_amount,
        )

        return CashOutReportResponse(
            start_date=start_d.strftime("%Y-%m-%d"),
            end_date=end_d.strftime("%Y-%m-%d"),
            timezone=tz_name,
            summary=summary,
            reasons_breakdown=reasons_breakdown,
            items=items,
            total_count=total_count,
            page=page,
            page_size=limit,
            company_name=business_settings.business_name,
            company_address=business_settings.business_address,
            company_phone=business_settings.business_phone,
        )


report_service = ReportService()

