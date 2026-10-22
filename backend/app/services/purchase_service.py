from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.inventory_batch import InventoryBatch
from app.models.sale import Sale, SaleItem
from app.models.supplier import Supplier
from app.models.user import User
from app.repositories.product_repository import product_repository
from app.repositories.purchase_repository import purchase_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.purchase import PurchaseCreate, PurchaseReportSummary, PurchaseResponse, PurchaseUpdate
from app.services.inventory_helper import reconcile_uncovered_sales_for_batch


class PurchaseService:
    async def create_purchase(
        self, db: AsyncSession, user_id: str, purchase_in: PurchaseCreate
    ) -> Purchase:
        """
        Creates a purchase order in a single database transaction.
        Automatically INCREASES product stock levels for all purchased items.
        """
        # Validate supplier
        supplier = await supplier_repository.get_by_id(db, id=purchase_in.supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID '{purchase_in.supplier_id}' not found.")

        # Purchase number handling
        if purchase_in.purchase_no and purchase_in.purchase_no.strip():
            existing = await purchase_repository.get_by_no(db, purchase_in.purchase_no.strip())
            if existing:
                raise ConflictException(f"Purchase order number '{purchase_in.purchase_no}' already exists.")
            code = purchase_in.purchase_no.strip()
        else:
            code = await purchase_repository.generate_purchase_no(db)

        subtotal_dec = Decimal("0.0")
        purchase_items: list[PurchaseItem] = []

        # Process each purchase line item and INCREASE stock
        for item_data in purchase_in.items:
            product = await product_repository.get_by_id(db, id=item_data.product_id)
            if not product:
                raise NotFoundException(f"Product with ID '{item_data.product_id}' not found.")
            if product.product_type == "FARM":
                raise BadRequestException(f"Farm products cannot be purchased via regular purchases (Product: {product.name}).")

            qty_dec = Decimal(str(item_data.quantity))
            discount_dec = Decimal(str(item_data.discount or 0.0))
            mode = item_data.pricing_mode or "unit_price"

            if mode == "total_price" and item_data.total_price is not None:
                # Mode B: User entered Total Price is AUTHORITATIVE.
                line_total_dec = Decimal(str(item_data.total_price))
                if line_total_dec < Decimal("0.0"):
                    line_total_dec = Decimal("0.0")
                unit_price = float(((line_total_dec + discount_dec) / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)) if qty_dec > 0 else 0.0
            else:
                # Mode A: User entered Unit Price is AUTHORITATIVE.
                mode = "unit_price"
                unit_price_dec = Decimal(str(item_data.unit_price))
                line_total_dec = (qty_dec * unit_price_dec) - discount_dec
                if line_total_dec < Decimal("0.0"):
                    line_total_dec = Decimal("0.0")
                unit_price = item_data.unit_price

            line_total = float(line_total_dec)
            subtotal_dec += line_total_dec

            # AUTOMATICALLY INCREASE PRODUCT STOCK
            product.current_stock += item_data.quantity
            db.add(product)

            p_item = PurchaseItem(
                product_id=product.id,
                quantity=item_data.quantity,
                unit_price=unit_price,
                discount=item_data.discount,
                total_price=line_total,
                pricing_mode=mode,
            )
            purchase_items.append(p_item)

            # Defer batch creation to set purchase_id after flush
            # We will use purchase_items for this, or create a list of batches

        # Financial Calculations
        discount_amount_dec = Decimal(str(purchase_in.discount_amount or 0.0))
        tax_amount_dec = Decimal(str(purchase_in.tax_amount or 0.0))
        paid_amount_dec = Decimal(str(purchase_in.paid_amount or 0.0))

        grand_total_dec = subtotal_dec - discount_amount_dec + tax_amount_dec
        if grand_total_dec < Decimal("0.0"):
            grand_total_dec = Decimal("0.0")

        paid_dec = paid_amount_dec
        if paid_dec > grand_total_dec:
            paid_dec = grand_total_dec

        due_dec = grand_total_dec - paid_dec
        if due_dec <= Decimal("0.0"):
            payment_status = "paid"
            due_dec = Decimal("0.0")
        elif paid_dec > Decimal("0.0"):
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        subtotal = float(subtotal_dec)
        grand_total = float(grand_total_dec)
        paid = float(paid_dec)
        due = float(due_dec)

        p_date = purchase_in.purchase_date or datetime.now(timezone.utc)
        if p_date.tzinfo is None:
            p_date = p_date.replace(tzinfo=timezone.utc)
        else:
            p_date = p_date.astimezone(timezone.utc)

        purchase = Purchase(
            purchase_no=code,
            invoice_no=purchase_in.invoice_no,
            supplier_id=supplier.id,
            user_id=user_id,
            purchase_date=p_date,
            subtotal=subtotal,
            discount_amount=float(discount_amount_dec),
            tax_amount=float(tax_amount_dec),
            grand_total=grand_total,
            paid_amount=paid,
            due_amount=due,
            payment_status=payment_status,
            notes=purchase_in.notes.strip() if (purchase_in.notes and purchase_in.notes.strip()) else None,
            items=purchase_items,
        )

        db.add(purchase)
        
        # Financial effect: update supplier ledger (balance)
        supplier.current_balance += due
        db.add(supplier)

        await db.flush()

        for p_item in purchase_items:
            qty_dec = Decimal(str(p_item.quantity))
            line_net_dec = Decimal(str(p_item.total_price))
            if subtotal_dec > Decimal("0.0") and discount_amount_dec > Decimal("0.0") and qty_dec > Decimal("0.0"):
                line_share = line_net_dec / subtotal_dec
                prop_discount_dec = discount_amount_dec * line_share
                effective_line_net = max(Decimal("0.0"), line_net_dec - prop_discount_dec)
                effective_unit_cost = float((effective_line_net / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
            else:
                effective_unit_cost = p_item.unit_price

            batch = InventoryBatch(
                product_id=p_item.product_id,
                purchase_id=purchase.id,
                quantity=p_item.quantity,
                remaining_quantity=p_item.quantity,
                unit_cost=effective_unit_cost,
                purchase_date=purchase.purchase_date,
            )
            db.add(batch)
            await db.flush()
            await reconcile_uncovered_sales_for_batch(db, batch)
            
        await db.flush()
        return await purchase_repository.get_by_id_loaded(db, purchase.id) or purchase

    async def _reconcile_consumed_sales_for_batch_cost_update(
        self,
        db: AsyncSession,
        batch: InventoryBatch,
        old_unit_cost: float,
        new_unit_cost: float,
        consumed_qty: float,
    ) -> None:
        """
        Retroactively updates SaleItem.cogs for sales that consumed units from this batch
        when the batch's unit_cost is edited.
        """
        if consumed_qty <= 0 or abs(new_unit_cost - old_unit_cost) < 1e-6:
            return

        cost_delta = new_unit_cost - old_unit_cost

        # 1. Determine total units consumed from batches of this product that appear BEFORE this batch in FIFO order
        batches_q = (
            select(InventoryBatch)
            .where(InventoryBatch.product_id == batch.product_id)
            .order_by(InventoryBatch.purchase_date.asc(), InventoryBatch.created_at.asc())
        )
        all_batches = (await db.execute(batches_q)).scalars().all()

        q_prior = 0.0
        for b in all_batches:
            if b.id == batch.id:
                break
            b_consumed = max(0.0, b.quantity - b.remaining_quantity)
            q_prior += b_consumed

        batch_start = q_prior
        batch_end = q_prior + consumed_qty

        # 2. Query all sale items of this product in FIFO order
        sales_q = (
            select(SaleItem)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(SaleItem.product_id == batch.product_id)
            .order_by(Sale.sale_date.asc(), SaleItem.created_at.asc())
        )
        sale_items = (await db.execute(sales_q)).scalars().all()

        cum_sales = 0.0
        for item in sale_items:
            sale_start = cum_sales
            sale_end = cum_sales + item.quantity
            cum_sales = sale_end

            overlap_start = max(sale_start, batch_start)
            overlap_end = min(sale_end, batch_end)
            overlap_qty = max(0.0, overlap_end - overlap_start)

            if overlap_qty > 0:
                cogs_adj = overlap_qty * cost_delta
                item.cogs = max(0.0, round(item.cogs + cogs_adj, 4))
                db.add(item)

            if cum_sales >= batch_end:
                break

        await db.flush()

    async def update_purchase(
        self, db: AsyncSession, purchase_id: str, purchase_in: PurchaseUpdate
    ) -> Purchase:
        """
        Updates purchase order and recalculates product stock levels safely.
        Reconciles net inventory differences without rejecting negative current stock.
        """
        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase order with ID '{purchase_id}' not found.")

        # Update purchase date if provided
        if purchase_in.purchase_date is not None:
            p_date = purchase_in.purchase_date
            if p_date.tzinfo is None:
                p_date = p_date.replace(tzinfo=timezone.utc)
            else:
                p_date = p_date.astimezone(timezone.utc)
            purchase.purchase_date = p_date

        if purchase_in.invoice_no is not None:
            purchase.invoice_no = purchase_in.invoice_no
        if "notes" in purchase_in.model_fields_set or "note" in purchase_in.model_fields_set:
            val = purchase_in.notes if purchase_in.notes is not None else purchase_in.note
            purchase.notes = val.strip() if (val and val.strip()) else None

        if purchase_in.items is None:
            old_due = purchase.due_amount

            # Recalculate basic financial fields
            if purchase_in.discount_amount is not None:
                purchase.discount_amount = purchase_in.discount_amount
            if purchase_in.tax_amount is not None:
                purchase.tax_amount = purchase_in.tax_amount
            if purchase_in.paid_amount is not None:
                purchase.paid_amount = purchase_in.paid_amount

            purchase.grand_total = max(0.0, purchase.subtotal - purchase.discount_amount + purchase.tax_amount)
            if purchase.paid_amount > purchase.grand_total:
                purchase.paid_amount = purchase.grand_total

            purchase.due_amount = max(0.0, purchase.grand_total - purchase.paid_amount)
            if purchase.due_amount <= 0:
                purchase.payment_status = "paid"
            elif purchase.paid_amount > 0:
                purchase.payment_status = "partial"
            else:
                purchase.payment_status = "unpaid"

            if purchase_in.purchase_date is not None:
                await db.execute(
                    update(InventoryBatch)
                    .where(InventoryBatch.purchase_id == purchase.id)
                    .values(purchase_date=purchase.purchase_date)
                )

            db.add(purchase)

            # Update supplier ledger based on the difference
            if purchase_in.supplier_id and purchase_in.supplier_id != purchase.supplier_id:
                old_supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
                if old_supplier:
                    old_supplier.current_balance -= old_due
                    db.add(old_supplier)
                new_supplier = await supplier_repository.get_by_id(db, purchase_in.supplier_id)
                if new_supplier:
                    new_supplier.current_balance += purchase.due_amount
                    db.add(new_supplier)
                purchase.supplier_id = purchase_in.supplier_id
            else:
                supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
                if supplier:
                    supplier.current_balance = supplier.current_balance - old_due + purchase.due_amount
                    db.add(supplier)

            await db.flush()
            return purchase

        # When items ARE provided:
        # 1. Map old and new quantities per product
        old_qty_by_prod: dict[str, float] = {}
        for old_item in purchase.items:
            old_qty_by_prod[old_item.product_id] = old_qty_by_prod.get(old_item.product_id, 0.0) + old_item.quantity

        new_qty_by_prod: dict[str, float] = {}
        for item_data in purchase_in.items:
            new_qty_by_prod[item_data.product_id] = new_qty_by_prod.get(item_data.product_id, 0.0) + item_data.quantity

        # 2. Check existing batches to ensure consumed quantities are not violated
        batches_q = select(InventoryBatch).where(InventoryBatch.purchase_id == purchase.id)
        existing_batches = (await db.execute(batches_q)).scalars().all()
        consumed_map: dict[str, float] = {}
        for b in existing_batches:
            consumed = b.quantity - b.remaining_quantity
            if consumed > 0:
                consumed_map[b.product_id] = consumed_map.get(b.product_id, 0.0) + consumed

        # Check if new items cover the already consumed quantities
        for prod_id, consumed_qty in consumed_map.items():
            if consumed_qty > 0:
                new_q = new_qty_by_prod.get(prod_id, 0.0)
                if new_q < consumed_qty:
                    prod = await product_repository.get_by_id(db, id=prod_id)
                    p_name = prod.name if prod else prod_id
                    raise BadRequestException(
                        f"Cannot update purchase: {consumed_qty} units of '{p_name}' have already been sold/consumed in sales."
                    )

        # 3. Validate products and reconcile Product.current_stock using net delta
        all_prod_ids = set(old_qty_by_prod.keys()) | set(new_qty_by_prod.keys())
        products_by_id: dict[str, Product] = {}
        for prod_id in all_prod_ids:
            prod = await product_repository.get_by_id(db, id=prod_id)
            if not prod:
                raise NotFoundException(f"Product with ID '{prod_id}' not found.")
            if prod.product_type == "FARM":
                raise BadRequestException(f"Farm products cannot be purchased via regular purchases (Product: {prod.name}).")
            products_by_id[prod_id] = prod

            # Reconcile net stock delta: new_qty - old_qty (allows negative stock)
            old_q = old_qty_by_prod.get(prod_id, 0.0)
            new_q = new_qty_by_prod.get(prod_id, 0.0)
            net_delta = new_q - old_q
            if net_delta != 0.0:
                prod.current_stock = round(float(prod.current_stock) + net_delta, 4)
                db.add(prod)

        # 4. Prepare new line items and calculate pricing
        subtotal_dec = Decimal("0.0")
        new_items: list[PurchaseItem] = []
        item_pricing_info: list[tuple[str, float, float]] = []

        for item_data in purchase_in.items:
            qty_dec = Decimal(str(item_data.quantity))
            discount_dec = Decimal(str(item_data.discount or 0.0))
            mode = item_data.pricing_mode or "unit_price"

            if mode == "total_price" and item_data.total_price is not None:
                # Mode B: User entered Total Price is AUTHORITATIVE.
                line_total_dec = Decimal(str(item_data.total_price))
                if line_total_dec < Decimal("0.0"):
                    line_total_dec = Decimal("0.0")
                unit_price = float(((line_total_dec + discount_dec) / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)) if qty_dec > 0 else 0.0
            else:
                # Mode A: User entered Unit Price is AUTHORITATIVE.
                mode = "unit_price"
                unit_price_dec = Decimal(str(item_data.unit_price))
                line_total_dec = (qty_dec * unit_price_dec) - discount_dec
                if line_total_dec < Decimal("0.0"):
                    line_total_dec = Decimal("0.0")
                unit_price = item_data.unit_price

            line_total = float(line_total_dec)
            subtotal_dec += line_total_dec

            new_items.append(
                PurchaseItem(
                    product_id=item_data.product_id,
                    quantity=item_data.quantity,
                    unit_price=unit_price,
                    discount=item_data.discount,
                    total_price=line_total,
                    pricing_mode=mode,
                )
            )
            item_pricing_info.append((item_data.product_id, item_data.quantity, unit_price, line_total_dec))

        # Calculate proportional order-level discount for batches
        order_discount_val = purchase_in.discount_amount if purchase_in.discount_amount is not None else purchase.discount_amount
        order_discount_dec = Decimal(str(order_discount_val or 0.0))
        if order_discount_dec < Decimal("0.0"):
            order_discount_dec = Decimal("0.0")

        batch_pricing_info: list[tuple[str, float, float]] = []
        for prod_id, item_qty, u_price, line_net_dec in item_pricing_info:
            qty_dec = Decimal(str(item_qty))
            if subtotal_dec > Decimal("0.0") and order_discount_dec > Decimal("0.0") and qty_dec > Decimal("0.0"):
                line_share = line_net_dec / subtotal_dec
                prop_discount_dec = order_discount_dec * line_share
                effective_line_net = max(Decimal("0.0"), line_net_dec - prop_discount_dec)
                effective_unit_cost = float((effective_line_net / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
            else:
                effective_unit_cost = u_price
            batch_pricing_info.append((prod_id, item_qty, effective_unit_cost))

        # 5. Reconcile inventory batches
        existing_batches_by_prod: dict[str, list[InventoryBatch]] = defaultdict(list)
        for b in existing_batches:
            existing_batches_by_prod[b.product_id].append(b)

        remaining_consumed_tracker = dict(consumed_map)

        for prod_id, item_qty, unit_cost in batch_pricing_info:
            consumed_total = remaining_consumed_tracker.get(prod_id, 0.0)
            allocated_consumed = min(item_qty, consumed_total)
            remaining_batch_qty = max(0.0, round(item_qty - allocated_consumed, 4))
            remaining_consumed_tracker[prod_id] = max(0.0, round(consumed_total - allocated_consumed, 4))

            old_batch_cost = None
            if existing_batches_by_prod[prod_id]:
                batch = existing_batches_by_prod[prod_id].pop(0)
                old_batch_cost = batch.unit_cost
                batch.quantity = item_qty
                batch.remaining_quantity = remaining_batch_qty
                batch.unit_cost = unit_cost
                batch.purchase_date = purchase.purchase_date
                db.add(batch)
            else:
                batch = InventoryBatch(
                    product_id=prod_id,
                    purchase_id=purchase.id,
                    quantity=item_qty,
                    remaining_quantity=remaining_batch_qty,
                    unit_cost=unit_cost,
                    purchase_date=purchase.purchase_date,
                )
                db.add(batch)

            await db.flush()

            # Retroactively update COGS for already-consumed units if unit_cost changed
            if (
                old_batch_cost is not None
                and allocated_consumed > 0
                and abs(unit_cost - old_batch_cost) > 1e-6
            ):
                await self._reconcile_consumed_sales_for_batch_cost_update(
                    db, batch, old_batch_cost, unit_cost, allocated_consumed
                )

            if remaining_batch_qty > 0:
                await reconcile_uncovered_sales_for_batch(db, batch)

        # Delete any unneeded old batches for removed items
        for old_batches_list in existing_batches_by_prod.values():
            for old_batch in old_batches_list:
                await db.delete(old_batch)

        # Ensure all batches for this purchase remain 100% in sync with purchase.purchase_date
        await db.execute(
            update(InventoryBatch)
            .where(InventoryBatch.purchase_id == purchase.id)
            .values(purchase_date=purchase.purchase_date)
        )

        # 6. Replace purchase items
        purchase.items.clear()
        purchase.items = new_items

        # 7. Recalculate financial totals
        discount_amount_dec = Decimal(str(purchase_in.discount_amount if purchase_in.discount_amount is not None else purchase.discount_amount))
        tax_amount_dec = Decimal(str(purchase_in.tax_amount if purchase_in.tax_amount is not None else purchase.tax_amount))
        paid_amount_dec = Decimal(str(purchase_in.paid_amount if purchase_in.paid_amount is not None else purchase.paid_amount))

        grand_total_dec = subtotal_dec - discount_amount_dec + tax_amount_dec
        if grand_total_dec < Decimal("0.0"):
            grand_total_dec = Decimal("0.0")

        paid_dec = paid_amount_dec
        if paid_dec > grand_total_dec:
            paid_dec = grand_total_dec

        due_dec = grand_total_dec - paid_dec
        if due_dec <= Decimal("0.0"):
            payment_status = "paid"
            due_dec = Decimal("0.0")
        elif paid_dec > Decimal("0.0"):
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        old_due = purchase.due_amount

        purchase.subtotal = float(subtotal_dec)
        purchase.discount_amount = float(discount_amount_dec)
        purchase.tax_amount = float(tax_amount_dec)
        purchase.grand_total = float(grand_total_dec)
        purchase.paid_amount = float(paid_dec)
        purchase.due_amount = float(due_dec)
        purchase.payment_status = payment_status
        due = float(due_dec)

        db.add(purchase)

        # Update supplier ledger based on the difference
        if purchase_in.supplier_id and purchase_in.supplier_id != purchase.supplier_id:
            old_supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
            if old_supplier:
                old_supplier.current_balance -= old_due
                db.add(old_supplier)
            new_supplier = await supplier_repository.get_by_id(db, purchase_in.supplier_id)
            if new_supplier:
                new_supplier.current_balance += due
                db.add(new_supplier)
            purchase.supplier_id = purchase_in.supplier_id
        else:
            supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
            if supplier:
                supplier.current_balance = supplier.current_balance - old_due + due
                db.add(supplier)

        await db.flush()
        return await purchase_repository.get_by_id_loaded(db, purchase.id) or purchase

    async def get_purchase(self, db: AsyncSession, purchase_id: str) -> Purchase:
        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase order with ID '{purchase_id}' not found.")
        return purchase

    async def get_purchases_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        product_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[Sequence[Purchase], int]:
        return await purchase_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            supplier_id=supplier_id,
            payment_status=payment_status,
            product_id=product_id,
            start_date=start_date,
            end_date=end_date,
        )

    async def get_purchase_summary(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        product_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        return await purchase_repository.get_report_summary(
            db,
            search=search,
            supplier_id=supplier_id,
            payment_status=payment_status,
            product_id=product_id,
            start_date=start_date,
            end_date=end_date,
        )

    # Alias for naming consistency with sale_service.get_sale_reports
    get_purchase_reports = get_purchase_summary

    async def generate_purchase_report(
        self,
        db: AsyncSession,
        report_type: str,  # today, date_wise, date_range, monthly
        target_date: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> PurchaseReportSummary:
        now = datetime.now(timezone.utc)

        if report_type == "today":
            start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
            end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)
            period_label = f"Today ({now.strftime('%Y-%m-%d')})"

        elif report_type == "date_wise" and target_date:
            dt = datetime.strptime(target_date, "%Y-%m-%d")
            start = datetime(dt.year, dt.month, dt.day, 0, 0, 0, tzinfo=timezone.utc)
            end = datetime(dt.year, dt.month, dt.day, 23, 59, 59, tzinfo=timezone.utc)
            period_label = f"Date: {target_date}"

        elif report_type == "date_range" and start_date_str and end_date_str:
            s_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
            e_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
            start = datetime(s_dt.year, s_dt.month, s_dt.day, 0, 0, 0, tzinfo=timezone.utc)
            end = datetime(e_dt.year, e_dt.month, e_dt.day, 23, 59, 59, tzinfo=timezone.utc)
            period_label = f"Period: {start_date_str} to {end_date_str}"

        elif report_type == "monthly":
            m = month or now.month
            y = year or now.year
            start = datetime(y, m, 1, 0, 0, 0, tzinfo=timezone.utc)
            # End of month calculation
            if m == 12:
                end = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc) - timedelta(seconds=1)
            else:
                end = datetime(y, m + 1, 1, 0, 0, 0, tzinfo=timezone.utc) - timedelta(seconds=1)
            period_label = f"Month: {y}-{m:02d}"

        else:
            # Default to current month
            start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
            end = now
            period_label = f"Current Month ({now.strftime('%Y-%m')})"

        purchases, total = await purchase_repository.get_filtered(
            db, skip=0, limit=1000, start_date=start, end_date=end
        )

        total_amount = sum(p.grand_total for p in purchases)
        total_paid = sum(p.paid_amount for p in purchases)
        total_due = sum(p.due_amount for p in purchases)

        return PurchaseReportSummary(
            period=period_label,
            total_purchases=total,
            total_amount=total_amount,
            total_paid=total_paid,
            total_due=total_due,
            purchases=[PurchaseResponse.model_validate(p) for p in purchases],
        )

    async def delete_purchase(self, db: AsyncSession, purchase_id: str) -> bool:
        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase with ID '{purchase_id}' not found.")

        from app.models.supplier_payment import SupplierPayment
        from app.models.product_return import ProductReturn

        pay_q = select(func.count(SupplierPayment.id)).where(SupplierPayment.purchase_id == purchase_id)
        pay_res = await db.execute(pay_q)
        if (pay_res.scalar() or 0) > 0:
            raise BadRequestException("Cannot delete purchase invoice with existing supplier payments.")

        ret_q = select(func.count(ProductReturn.id)).where(ProductReturn.purchase_id == purchase_id)
        ret_res = await db.execute(ret_q)
        if (ret_res.scalar() or 0) > 0:
            raise BadRequestException("Cannot delete purchase invoice with existing product returns.")

        # Check if units from this purchase were already sold/consumed
        batches_q = select(InventoryBatch).where(InventoryBatch.purchase_id == purchase_id)
        batches = (await db.execute(batches_q)).scalars().all()
        for b in batches:
            if b.remaining_quantity < b.quantity:
                raise BadRequestException(
                    "Cannot delete purchase order: items from this purchase have already been sold/consumed in sales."
                )

        for item in purchase.items:
            product = await product_repository.get_by_id(db, item.product_id)
            if product:
                product.current_stock -= item.quantity
                db.add(product)

        # Delete inventory batches for this purchase
        await db.execute(delete(InventoryBatch).where(InventoryBatch.purchase_id == purchase_id))

        supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
        if supplier:
            supplier.current_balance -= purchase.due_amount
            db.add(supplier)

        await db.delete(purchase)
        await db.commit()
        return True

    async def hard_delete_purchase(self, db: AsyncSession, purchase_id: str) -> bool:
        from app.models.supplier_payment import SupplierPayment
        from app.models.product_return import ProductReturn, ProductReturnItem

        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase with ID '{purchase_id}' not found.")

        returns_q = select(ProductReturn.id).where(ProductReturn.purchase_id == purchase_id)
        returns_res = await db.execute(returns_q)
        return_ids = returns_res.scalars().all()
        if return_ids:
            await db.execute(delete(ProductReturnItem).where(ProductReturnItem.product_return_id.in_(return_ids)))
            await db.execute(delete(ProductReturn).where(ProductReturn.id.in_(return_ids)))

        supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)

        sp_q = select(SupplierPayment).where(SupplierPayment.purchase_id == purchase_id)
        sp_res = await db.execute(sp_q)
        for sp in sp_res.scalars():
            if supplier:
                supplier.current_balance += sp.amount
                
        await db.execute(delete(SupplierPayment).where(SupplierPayment.purchase_id == purchase_id))

        # Delete inventory batches for this purchase
        await db.execute(delete(InventoryBatch).where(InventoryBatch.purchase_id == purchase_id))

        for item in purchase.items:
            product = await product_repository.get_by_id(db, item.product_id)
            if product:
                product.current_stock -= item.quantity
                db.add(product)

        if supplier:
            supplier.current_balance -= purchase.due_amount
            db.add(supplier)

        await db.delete(purchase)
        await db.commit()
        return True


purchase_service = PurchaseService()
