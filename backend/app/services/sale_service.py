import json
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.inventory_batch import InventoryBatch
from app.repositories.customer_repository import customer_repository
from app.repositories.product_repository import product_repository
from app.repositories.sale_repository import sale_repository
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleUpdate
from app.services.inventory_helper import (
    get_last_purchase_cost,
    record_uncovered_sale_item,
    remove_uncovered_sale_logs,
)


class SaleService:
    async def _ensure_product_batches(self, db: AsyncSession, product: Product) -> None:
        """
        Ensures that an active product with stock has an opening InventoryBatch if none exists.
        This guarantees backward compatibility for products created with opening stock
        prior to batch-tracking or initialized directly without calling product_service.create_product.
        """
        if product.product_type == "FARM":
            return
        q = select(func.count(InventoryBatch.id)).where(InventoryBatch.product_id == product.id)
        res = await db.execute(q)
        batch_count = res.scalar() or 0
        if batch_count == 0 and product.opening_stock > 0:
            initial_qty = float(product.opening_stock)
            if initial_qty <= 0.0:
                return
            rem_qty = max(0.0, min(initial_qty, float(product.current_stock)))
            unit_cost = (
                float(product.opening_stock_unit_cost)
                if product.opening_stock_unit_cost and product.opening_stock_unit_cost > 0
                else 0.0
            )
            batch = InventoryBatch(
                product_id=product.id,
                purchase_id=None,
                quantity=initial_qty,
                remaining_quantity=round(rem_qty, 4),
                unit_cost=unit_cost,
                purchase_date=product.created_at or datetime.now(timezone.utc),
            )
            db.add(batch)
            await db.flush()

    async def create_sale(self, db: AsyncSession, user_id: str, sale_in: SaleCreate) -> Sale:

        """
        Creates a new Sale invoice inside a single atomic database transaction.
        Automatically decreases product stock and increases customer due balance.
        Enforces non-negative stock constraint.
        """
        # 1. Validate Customer
        customer = await customer_repository.get_by_id(db, id=sale_in.customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{sale_in.customer_id}' not found.")
        if customer.status != "active":
            raise BadRequestException(f"Customer '{customer.name}' is currently inactive.")

        # 2. Invoice Number handling
        if sale_in.invoice_no and sale_in.invoice_no.strip():
            existing_invoice = await sale_repository.get_by_invoice_no(db, sale_in.invoice_no.strip())
            if existing_invoice:
                raise ConflictException(f"Invoice number '{sale_in.invoice_no}' already exists.")
            inv_no = sale_in.invoice_no.strip()
        else:
            inv_no = await sale_repository.generate_invoice_no(db)

        # 3. Process Line Items and Validate Stock
        prepared_items = []
        subtotal_dec = Decimal("0.0")

        for item_in in sale_in.items:
            product = await product_repository.get_by_id(db, id=item_in.product_id)
            if not product:
                raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")
            if product.product_type == "FARM":
                raise BadRequestException(f"Farm products cannot be sold via regular sales (Product: {product.name}).")
            if product.status != "active":
                raise BadRequestException(f"Product '{product.name}' is inactive and cannot be sold.")

            qty_dec = Decimal(str(item_in.quantity))
            discount_dec = Decimal(str(item_in.discount or 0.0))
            mode = item_in.pricing_mode or "unit_price"

            if mode == "total_price" and item_in.total_price is not None:
                # Mode B: User entered Total Price is AUTHORITATIVE.
                item_total_dec = Decimal(str(item_in.total_price))
                if item_total_dec < Decimal("0.0"):
                    item_total_dec = Decimal("0.0")
                if item_in.unit_price > 0:
                    unit_price = item_in.unit_price
                else:
                    unit_price = float(((item_total_dec + discount_dec) / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)) if qty_dec > 0 else 0.0
            else:
                # Mode A: User entered Unit Price is AUTHORITATIVE.
                mode = "unit_price"
                unit_price_dec = Decimal(str(item_in.unit_price))
                item_total_dec = (qty_dec * unit_price_dec) - discount_dec
                if item_total_dec < Decimal("0.0"):
                    item_total_dec = Decimal("0.0")
                unit_price = item_in.unit_price

            item_total = float(item_total_dec)
            subtotal_dec += item_total_dec

            prepared_items.append({
                "product_id": product.id,
                "quantity": item_in.quantity,
                "unit_price": unit_price,
                "discount": item_in.discount,
                "total_price": item_total,
                "pricing_mode": mode,
                "product_model": product,
            })

        # 4. Financial Calculations
        discount_amount_dec = Decimal(str(sale_in.discount_amount or 0.0))
        tax_amount_dec = Decimal(str(sale_in.tax_amount or 0.0))
        paid_amount_dec = Decimal(str(sale_in.paid_amount or 0.0))

        grand_total_dec = subtotal_dec - discount_amount_dec + tax_amount_dec
        if grand_total_dec < Decimal("0.0"):
            grand_total_dec = Decimal("0.0")

        due_amount_dec = grand_total_dec - paid_amount_dec
        if due_amount_dec <= Decimal("0.0"):
            due_amount_dec = Decimal("0.0")
            payment_status = "paid"
        elif paid_amount_dec > Decimal("0.0"):
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        subtotal = float(subtotal_dec)
        grand_total = float(grand_total_dec)
        due_amount = float(due_amount_dec)

        sale_date = sale_in.sale_date or datetime.now(timezone.utc)

        # 5. Atomic Transaction: Create Sale Header
        sale = Sale(
            invoice_no=inv_no,
            customer_id=customer.id,
            user_id=user_id,
            sale_date=sale_date,
            subtotal=subtotal,
            discount_amount=float(discount_amount_dec),
            tax_amount=float(tax_amount_dec),
            grand_total=grand_total,
            paid_amount=float(paid_amount_dec),
            due_amount=due_amount,
            payment_status=payment_status,
            notes=(sale_in.notes or sale_in.note).strip() if (sale_in.notes or sale_in.note) and (sale_in.notes or sale_in.note).strip() else None,
        )
        db.add(sale)
        await db.flush()

        # 6. Create Line Items and Decrease Product Stock
        for item_data in prepared_items:
            product = item_data["product_model"]
            await self._ensure_product_batches(db, product)

            # FIFO COGS Calculation
            batch_query = select(InventoryBatch).where(
                InventoryBatch.product_id == item_data["product_id"],
                InventoryBatch.remaining_quantity > 0
            ).order_by(InventoryBatch.purchase_date.asc(), InventoryBatch.created_at.asc())
            
            batch_result = await db.execute(batch_query)
            available_batches = batch_result.scalars().all()

            qty_to_deduct = item_data["quantity"]
            total_cogs = 0.0

            for b in available_batches:
                if qty_to_deduct <= 0:
                    break
                deduct = min(b.remaining_quantity, qty_to_deduct)
                b.remaining_quantity = max(0.0, round(b.remaining_quantity - deduct, 4))
                total_cogs += deduct * b.unit_cost
                qty_to_deduct = max(0.0, round(qty_to_deduct - deduct, 4))
                db.add(b)

            uncovered_qty = 0.0
            fallback_cost = 0.0
            if qty_to_deduct > 0:
                uncovered_qty = qty_to_deduct
                fallback_cost = await get_last_purchase_cost(db, product)
                total_cogs += uncovered_qty * fallback_cost

            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                discount=item_data["discount"],
                total_price=item_data["total_price"],
                pricing_mode=item_data["pricing_mode"],
                cogs=round(total_cogs, 4),
            )
            db.add(sale_item)
            await db.flush()

            if uncovered_qty > 0:
                await record_uncovered_sale_item(
                    db=db,
                    user_id=user_id,
                    sale_id=sale.id,
                    sale_item_id=sale_item.id,
                    product_id=product.id,
                    uncovered_quantity=uncovered_qty,
                    provisional_unit_cost=fallback_cost,
                )

            # DECREASE PRODUCT STOCK (Allows negative stock)
            product = item_data["product_model"]
            product.current_stock -= item_data["quantity"]
            db.add(product)

        # 7. Update Customer Current Balance
        customer.current_balance += due_amount
        db.add(customer)

        await db.commit()
        return await self.get_sale(db, sale.id)

    async def update_sale(self, db: AsyncSession, sale_id: str, sale_in: SaleUpdate) -> Sale:
        """
        Updates an existing Sale invoice inside a single atomic transaction.
        Recalculates stock differences and updates customer balance.
        """
        sale = await sale_repository.get_by_id(db, id=sale_id)
        if not sale:
            raise NotFoundException(f"Sale invoice with ID '{sale_id}' not found.")

        old_due = sale.due_amount
        old_customer_id = sale.customer_id

        # Update customer if changed
        if sale_in.customer_id and sale_in.customer_id != sale.customer_id:
            new_customer = await customer_repository.get_by_id(db, id=sale_in.customer_id)
            if not new_customer:
                raise NotFoundException(f"Customer with ID '{sale_in.customer_id}' not found.")
            sale.customer_id = new_customer.id

        if sale_in.sale_date:
            sale.sale_date = sale_in.sale_date
        if "notes" in sale_in.model_fields_set or "note" in sale_in.model_fields_set:
            raw_note = sale_in.notes if "notes" in sale_in.model_fields_set else sale_in.note
            sale.notes = raw_note.strip() if raw_note and raw_note.strip() else None

        # Process Line Items Update if provided
        if sale_in.items is not None:
            # 1. Restore product stock and inventory batches from previous line items
            for old_item in sale.items:
                product = await product_repository.get_by_id(db, id=old_item.product_id)
                if product:
                    product.current_stock += old_item.quantity
                    db.add(product)
                
                # Determine how much was actually covered by inventory batches vs uncovered
                q_log = select(ActivityLog).where(
                    ActivityLog.entity_type == "SaleItem",
                    ActivityLog.entity_id == old_item.id,
                    ActivityLog.action.in_(["UNCOVERED_SALE_ITEM", "RECONCILED_SALE_ITEM"])
                )
                res_log = await db.execute(q_log)
                log_entry = res_log.scalar_one_or_none()
                net_uncovered = 0.0
                if log_entry:
                    try:
                        data = json.loads(log_entry.payload or "{}")
                        unc = float(data.get("uncovered_quantity", 0.0))
                        rec = float(data.get("reconciled_quantity", 0.0))
                        net_uncovered = max(0.0, unc - rec)
                    except Exception:
                        pass

                qty_to_restore = max(0.0, round(old_item.quantity - net_uncovered, 4))

                # Restore InventoryBatches (reverse FIFO)
                if qty_to_restore > 0:
                    restore_query = select(InventoryBatch).where(
                        InventoryBatch.product_id == old_item.product_id,
                        InventoryBatch.remaining_quantity < InventoryBatch.quantity
                    ).order_by(InventoryBatch.purchase_date.desc(), InventoryBatch.created_at.desc())
                    
                    restore_result = await db.execute(restore_query)
                    for b in restore_result.scalars().all():
                        if qty_to_restore <= 0:
                            break
                        can_restore = max(0.0, round(b.quantity - b.remaining_quantity, 4))
                        if can_restore <= 0:
                            continue
                        restore_amt = min(can_restore, qty_to_restore)
                        b.remaining_quantity = min(b.quantity, max(0.0, round(b.remaining_quantity + restore_amt, 4)))
                        qty_to_restore = max(0.0, round(qty_to_restore - restore_amt, 4))
                        db.add(b)

            await remove_uncovered_sale_logs(db, [old_item.id for old_item in sale.items])
            # Explicit flush so PostgreSQL session state is synchronized before Step 2 queries
            await db.flush()

            # 2. Process new items and calculate COGS
            subtotal_dec = Decimal("0.0")
            new_items_with_uncovered = []
            for item_in in sale_in.items:
                product = await product_repository.get_by_id(db, id=item_in.product_id)
                if not product:
                    raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")
                if product.product_type == "FARM":
                    raise BadRequestException(f"Farm products cannot be sold via regular sales (Product: {product.name}).")

                qty_dec = Decimal(str(item_in.quantity))
                discount_dec = Decimal(str(item_in.discount or 0.0))
                mode = item_in.pricing_mode or "unit_price"

                if mode == "total_price" and item_in.total_price is not None:
                    # Mode B: User entered Total Price is AUTHORITATIVE.
                    item_total_dec = Decimal(str(item_in.total_price))
                    if item_total_dec < Decimal("0.0"):
                        item_total_dec = Decimal("0.0")
                    if item_in.unit_price > 0:
                        unit_price = item_in.unit_price
                    else:
                        unit_price = float(((item_total_dec + discount_dec) / qty_dec).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)) if qty_dec > 0 else 0.0
                else:
                    # Mode A: User entered Unit Price is AUTHORITATIVE.
                    mode = "unit_price"
                    unit_price_dec = Decimal(str(item_in.unit_price))
                    item_total_dec = (qty_dec * unit_price_dec) - discount_dec
                    if item_total_dec < Decimal("0.0"):
                        item_total_dec = Decimal("0.0")
                    unit_price = item_in.unit_price

                item_total = float(item_total_dec)
                subtotal_dec += item_total_dec

                await self._ensure_product_batches(db, product)

                # FIFO COGS Calculation
                batch_query = select(InventoryBatch).where(
                    InventoryBatch.product_id == product.id,
                    InventoryBatch.remaining_quantity > 0
                ).order_by(InventoryBatch.purchase_date.asc(), InventoryBatch.created_at.asc())
                
                batch_result = await db.execute(batch_query)
                available_batches = batch_result.scalars().all()

                qty_to_deduct = item_in.quantity
                total_cogs = 0.0

                for b in available_batches:
                    if qty_to_deduct <= 0:
                        break
                    deduct = min(b.remaining_quantity, qty_to_deduct)
                    b.remaining_quantity = max(0.0, round(b.remaining_quantity - deduct, 4))
                    total_cogs += deduct * b.unit_cost
                    qty_to_deduct = max(0.0, round(qty_to_deduct - deduct, 4))
                    db.add(b)

                uncovered_qty = 0.0
                fallback_cost = 0.0
                if qty_to_deduct > 0:
                    uncovered_qty = qty_to_deduct
                    fallback_cost = await get_last_purchase_cost(db, product)
                    total_cogs += uncovered_qty * fallback_cost

                sale_item = SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=item_in.quantity,
                    unit_price=unit_price,
                    discount=item_in.discount,
                    total_price=item_total,
                    pricing_mode=mode,
                    cogs=round(total_cogs, 4),
                )
                new_items_with_uncovered.append((sale_item, uncovered_qty, fallback_cost, product.id))

                # Deduct new stock (Allows negative stock)
                product.current_stock -= item_in.quantity
                db.add(product)

            # Clear old items and flush delete first to ensure strict ordering
            sale.items.clear()
            await db.flush()
            for s_item, unc_qty, fb_cost, prod_id in new_items_with_uncovered:
                s_item.sale_id = sale.id
                sale.items.append(s_item)
            sale.subtotal = float(subtotal_dec)
            await db.flush()

            for s_item, unc_qty, fb_cost, prod_id in new_items_with_uncovered:
                if unc_qty > 0:
                    await record_uncovered_sale_item(
                        db=db,
                        user_id=sale.user_id,
                        sale_id=sale.id,
                        sale_item_id=s_item.id,
                        product_id=prod_id,
                        uncovered_quantity=unc_qty,
                        provisional_unit_cost=fb_cost,
                    )

        # Financial Calculations Update
        discount_amount_dec = Decimal(str(sale_in.discount_amount if sale_in.discount_amount is not None else sale.discount_amount))
        tax_amount_dec = Decimal(str(sale_in.tax_amount if sale_in.tax_amount is not None else sale.tax_amount))
        paid_amount_dec = Decimal(str(sale_in.paid_amount if sale_in.paid_amount is not None else sale.paid_amount))
        subtotal_dec = Decimal(str(sale.subtotal))

        sale.discount_amount = float(discount_amount_dec)
        sale.tax_amount = float(tax_amount_dec)
        sale.paid_amount = float(paid_amount_dec)

        grand_total_dec = subtotal_dec - discount_amount_dec + tax_amount_dec
        if grand_total_dec < Decimal("0.0"):
            grand_total_dec = Decimal("0.0")
        sale.grand_total = float(grand_total_dec)

        due_amount_dec = grand_total_dec - paid_amount_dec
        if due_amount_dec <= Decimal("0.0"):
            sale.due_amount = 0.0
            sale.payment_status = "paid"
        elif paid_amount_dec > Decimal("0.0"):
            sale.due_amount = float(due_amount_dec)
            sale.payment_status = "partial"
        else:
            sale.due_amount = float(due_amount_dec)
            sale.payment_status = "unpaid"

        new_due = sale.due_amount
        db.add(sale)

        # Update Customer Balance Differences
        if old_customer_id == sale.customer_id:
            customer = await customer_repository.get_by_id(db, id=sale.customer_id)
            if customer:
                customer.current_balance -= old_due
                customer.current_balance += new_due
                db.add(customer)
        else:
            # Reverse due on old customer
            old_customer = await customer_repository.get_by_id(db, id=old_customer_id)
            if old_customer:
                old_customer.current_balance -= old_due
                db.add(old_customer)
            # Add due to new customer
            new_customer = await customer_repository.get_by_id(db, id=sale.customer_id)
            if new_customer:
                new_customer.current_balance += new_due
                db.add(new_customer)

        await db.commit()
        return await self.get_sale(db, sale.id)

    async def delete_sale(self, db: AsyncSession, sale_id: str) -> bool:
        """
        Deletes a Sale invoice inside an atomic transaction.
        Restores product current_stock and reduces customer due balance.
        """
        sale = await sale_repository.get_by_id(db, id=sale_id)
        if not sale:
            raise NotFoundException(f"Sale invoice with ID '{sale_id}' not found.")

        # 1. Restore Product Current Stock and Inventory Batches
        for item in sale.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            if product:
                product.current_stock += item.quantity
                db.add(product)
                
            q_log = select(ActivityLog).where(
                ActivityLog.entity_type == "SaleItem",
                ActivityLog.entity_id == item.id,
                ActivityLog.action.in_(["UNCOVERED_SALE_ITEM", "RECONCILED_SALE_ITEM"])
            )
            res_log = await db.execute(q_log)
            log_entry = res_log.scalar_one_or_none()
            net_uncovered = 0.0
            if log_entry:
                try:
                    data = json.loads(log_entry.payload or "{}")
                    unc = float(data.get("uncovered_quantity", 0.0))
                    rec = float(data.get("reconciled_quantity", 0.0))
                    net_uncovered = max(0.0, unc - rec)
                except Exception:
                    pass

            qty_to_restore = max(0.0, round(item.quantity - net_uncovered, 4))
            if qty_to_restore > 0:
                restore_query = select(InventoryBatch).where(
                    InventoryBatch.product_id == item.product_id,
                    InventoryBatch.remaining_quantity < InventoryBatch.quantity
                ).order_by(InventoryBatch.purchase_date.desc(), InventoryBatch.created_at.desc())
                
                restore_result = await db.execute(restore_query)
                for b in restore_result.scalars().all():
                    if qty_to_restore <= 0:
                        break
                    can_restore = max(0.0, round(b.quantity - b.remaining_quantity, 4))
                    if can_restore <= 0:
                        continue
                    restore_amt = min(can_restore, qty_to_restore)
                    b.remaining_quantity = min(b.quantity, max(0.0, round(b.remaining_quantity + restore_amt, 4)))
                    qty_to_restore = max(0.0, round(qty_to_restore - restore_amt, 4))
                    db.add(b)

        await remove_uncovered_sale_logs(db, [item.id for item in sale.items])

        # 2. Adjust Customer Due Balance (Reverse the sale due)
        customer = await customer_repository.get_by_id(db, id=sale.customer_id)
        if customer:
            customer.current_balance -= sale.due_amount
            db.add(customer)

        # 3. Delete Sale Record
        await db.delete(sale)
        await db.commit()
        return True

    async def hard_delete_sale(self, db: AsyncSession, sale_id: str) -> bool:
        """
        Permanently hard deletes a Sale invoice and all linked returns/collections:
        1. SaleReturnItems & SaleReturns for this sale
        2. CustomerCollections linked to this sale
        3. Restores stock quantities for line items
        4. Adjusts Customer balance
        5. Deletes SaleItems & Sale record
        """
        from app.models.customer_collection import CustomerCollection
        from app.models.sale_return import SaleReturn, SaleReturnItem

        sale = await sale_repository.get_by_id(db, id=sale_id)
        if not sale:
            raise NotFoundException(f"Sale invoice with ID '{sale_id}' not found.")

        # 1. Delete linked SaleReturns and items
        returns_q = select(SaleReturn.id).where(SaleReturn.sale_id == sale_id)
        returns_res = await db.execute(returns_q)
        return_ids = returns_res.scalars().all()
        if return_ids:
            await db.execute(delete(SaleReturnItem).where(SaleReturnItem.sale_return_id.in_(return_ids)))
            await db.execute(delete(SaleReturn).where(SaleReturn.id.in_(return_ids)))

        # 2. Delete linked CustomerCollections
        await db.execute(delete(CustomerCollection).where(CustomerCollection.sale_id == sale_id))

        # 3. Restore Product Current Stock and Inventory Batches
        for item in sale.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            if product:
                product.current_stock += item.quantity
                db.add(product)
                
            q_log = select(ActivityLog).where(
                ActivityLog.entity_type == "SaleItem",
                ActivityLog.entity_id == item.id,
                ActivityLog.action.in_(["UNCOVERED_SALE_ITEM", "RECONCILED_SALE_ITEM"])
            )
            res_log = await db.execute(q_log)
            log_entry = res_log.scalar_one_or_none()
            net_uncovered = 0.0
            if log_entry:
                try:
                    data = json.loads(log_entry.payload or "{}")
                    unc = float(data.get("uncovered_quantity", 0.0))
                    rec = float(data.get("reconciled_quantity", 0.0))
                    net_uncovered = max(0.0, unc - rec)
                except Exception:
                    pass

            qty_to_restore = max(0.0, round(item.quantity - net_uncovered, 4))
            if qty_to_restore > 0:
                restore_query = select(InventoryBatch).where(
                    InventoryBatch.product_id == item.product_id,
                    InventoryBatch.remaining_quantity < InventoryBatch.quantity
                ).order_by(InventoryBatch.purchase_date.desc(), InventoryBatch.created_at.desc())
                
                restore_result = await db.execute(restore_query)
                for b in restore_result.scalars().all():
                    if qty_to_restore <= 0:
                        break
                    can_restore = max(0.0, round(b.quantity - b.remaining_quantity, 4))
                    if can_restore <= 0:
                        continue
                    restore_amt = min(can_restore, qty_to_restore)
                    b.remaining_quantity = min(b.quantity, max(0.0, round(b.remaining_quantity + restore_amt, 4)))
                    qty_to_restore = max(0.0, round(qty_to_restore - restore_amt, 4))
                    db.add(b)

        await remove_uncovered_sale_logs(db, [item.id for item in sale.items])

        # 4. Adjust Customer Due Balance (Reverse the sale due)
        customer = await customer_repository.get_by_id(db, id=sale.customer_id)
        if customer:
            customer.current_balance -= sale.due_amount
            db.add(customer)

        # 5. Delete Sale Record
        await db.delete(sale)
        await db.commit()
        return True

    async def get_sale(self, db: AsyncSession, sale_id: str) -> Sale:
        sale = await sale_repository.get_by_id(db, id=sale_id)
        if not sale:
            raise NotFoundException(f"Sale invoice with ID '{sale_id}' not found.")
        return sale

    async def get_sales_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[Sale], int]:
        return await sale_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            customer_id=customer_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
        )

    async def get_sale_reports(
        self,
        db: AsyncSession,
        *,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        return await sale_repository.get_report_summary(
            db,
            search=search,
            customer_id=customer_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
        )


sale_service = SaleService()
