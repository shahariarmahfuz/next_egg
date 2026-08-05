import json
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.product import Product
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier import Supplier
from app.repositories.product_repository import product_repository
from app.repositories.product_return_repository import product_return_repository
from app.repositories.purchase_repository import purchase_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.product_return import (
    ProductReturnCreate,
    ProductReturnUpdate,
)


class ProductReturnService:
    async def get_purchase_returnable_info(self, db: AsyncSession, purchase_identifier: str) -> dict:
        """
        Fetches purchase order info along with previously returned and remaining returnable quantities.
        """
        purchase = await purchase_repository.get_by_id(db, id=purchase_identifier)
        if not purchase:
            query = select(Purchase).where(
                (Purchase.purchase_no == purchase_identifier.strip()) | (Purchase.invoice_no == purchase_identifier.strip())
            )
            res = await db.execute(query)
            purchase = res.scalars().first()

        if not purchase:
            raise NotFoundException(f"Purchase order '{purchase_identifier}' not found.")

        supplier = await supplier_repository.get_by_id(db, id=purchase.supplier_id)

        prev_returns = await product_return_repository.get_previously_returned_quantities(db, purchase.id)

        returnable_items = []
        for item in purchase.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            prev_returned_qty = prev_returns.get(item.product_id, 0.0)
            returnable_qty = max(0.0, item.quantity - prev_returned_qty)

            returnable_items.append({
                "product_id": item.product_id,
                "product_name": product.name if product else "Unknown Product",
                "product_code": product.product_code if product else "",
                "unit": product.unit if product else "pcs",
                "purchased_quantity": item.quantity,
                "previously_returned_qty": prev_returned_qty,
                "returnable_qty": returnable_qty,
                "unit_price": item.unit_price,
            })

        return {
            "purchase_id": purchase.id,
            "purchase_no": purchase.purchase_no,
            "invoice_no": purchase.invoice_no,
            "purchase_date": purchase.purchase_date,
            "supplier_id": purchase.supplier_id,
            "supplier_name": supplier.name if supplier else "N/A",
            "supplier_phone": supplier.phone if supplier else "",
            "supplier_code": supplier.supplier_code if supplier else "",
            "grand_total": purchase.grand_total,
            "paid_amount": purchase.paid_amount,
            "due_amount": purchase.due_amount,
            "items": returnable_items,
        }

    async def create_product_return(
        self, db: AsyncSession, user_id: str, return_in: ProductReturnCreate
    ) -> ProductReturn:
        """
        Creates a new Product Return voucher inside a single database transaction.
        - Automatically decreases product stock (-qty).
        - Recalculates supplier current due balance (- (grand_total - refund_received)).
        - Recalculates linked purchase due_amount & status.
        - Enforces returnable quantity and inventory stock availability.
        """
        try:
            # 1. Validate Supplier
            supplier = await supplier_repository.get_by_id(db, id=return_in.supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{return_in.supplier_id}' not found.")

            # 2. Validate Purchase if linked
            purchase = None
            prev_returns = {}
            if return_in.purchase_id:
                purchase = await purchase_repository.get_by_id(db, id=return_in.purchase_id)
                if not purchase:
                    raise NotFoundException(f"Linked Purchase with ID '{return_in.purchase_id}' not found.")
                prev_returns = await product_return_repository.get_previously_returned_quantities(db, purchase.id)

            # 3. Process Return Items & Enforce Constraints
            prepared_items = []
            return_grand_total = 0.0

            for item_in in return_in.items:
                product = await product_repository.get_by_id(db, id=item_in.product_id)
                if not product:
                    raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")

                if item_in.quantity <= 0:
                    raise BadRequestException(f"Return quantity for product '{product.name}' must be greater than zero.")

                # Check purchase returnable quantity limit if linked
                if purchase:
                    matching_item = next((pi for pi in purchase.items if pi.product_id == item_in.product_id), None)
                    if not matching_item:
                        raise BadRequestException(
                            f"Product '{product.name}' was not part of original Purchase Order {purchase.purchase_no}."
                        )
                    prev_returned = prev_returns.get(item_in.product_id, 0.0)
                    returnable_qty = max(0.0, matching_item.quantity - prev_returned)
                    if item_in.quantity > returnable_qty:
                        raise BadRequestException(
                            f"Return quantity ({item_in.quantity}) for product '{product.name}' "
                            f"exceeds remaining returnable quantity ({returnable_qty})."
                        )

                # Check stock availability to return to supplier
                if product.current_stock < item_in.quantity:
                    raise BadRequestException(
                        f"Insufficient stock for product '{product.name}' to return. "
                        f"Available stock: {product.current_stock}, Returning: {item_in.quantity}."
                    )

                item_total = item_in.quantity * item_in.unit_price
                return_grand_total += item_total

                prepared_items.append({
                    "product_id": product.id,
                    "product_model": product,
                    "quantity": item_in.quantity,
                    "unit_price": item_in.unit_price,
                    "total_price": item_total,
                })

            return_grand_total = round(return_grand_total, 2)
            if return_in.refund_received > return_grand_total:
                raise BadRequestException(
                    f"Refund received (${return_in.refund_received:.2f}) cannot exceed return total (${return_grand_total:.2f})."
                )

            # 4. Generate Voucher Number
            return_no = await product_return_repository.generate_return_no(db)
            ret_date = return_in.return_date or datetime.now(timezone.utc)

            # 5. Create Return Header
            product_return = ProductReturn(
                return_no=return_no,
                purchase_id=return_in.purchase_id,
                supplier_id=supplier.id,
                user_id=user_id,
                return_date=ret_date,
                grand_total=return_grand_total,
                refund_received=return_in.refund_received,
                reason=return_in.reason,
            )
            db.add(product_return)
            await db.flush()

            # 6. Create Items & DECREASE PRODUCT STOCK
            for item_data in prepared_items:
                ret_item = ProductReturnItem(
                    product_return_id=product_return.id,
                    product_id=item_data["product_id"],
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    total_price=item_data["total_price"],
                )
                db.add(ret_item)

                # DECREASE PRODUCT STOCK
                product = item_data["product_model"]
                product.current_stock -= item_data["quantity"]
                db.add(product)

            # 7. Recalculate Supplier Due & Purchase Due Summary
            net_debt_reduction = return_grand_total - return_in.refund_received
            supplier.current_balance -= net_debt_reduction
            db.add(supplier)

            if purchase:
                purchase.due_amount = max(0.0, round(purchase.due_amount - net_debt_reduction, 2))
                if purchase.due_amount <= 0:
                    purchase.payment_status = "paid"
                elif purchase.paid_amount > 0:
                    purchase.payment_status = "partial"
                db.add(purchase)

            # 8. Activity Audit Log
            log_payload = json.dumps({
                "return_no": return_no,
                "purchase_id": return_in.purchase_id,
                "supplier_id": supplier.id,
                "grand_total": return_grand_total,
                "refund_received": return_in.refund_received,
                "net_debt_reduction": net_debt_reduction,
                "updated_supplier_due": supplier.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="product_return.create",
                entity_type="product_return",
                entity_id=product_return.id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 9. Single Atomic Transaction Commit
            await db.commit()

            return await self.get_product_return(db, product_return.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create product return: {str(e)}")
            raise e

    async def update_product_return(
        self, db: AsyncSession, user_id: str, return_id: str, return_in: ProductReturnUpdate
    ) -> ProductReturn:
        """
        Updates an existing Product Return inside a single database transaction.
        Reverts old stock & balance effects, applies new parameters, and recalculates all totals.
        """
        try:
            product_return = await product_return_repository.get_by_id(db, id=return_id)
            if not product_return:
                raise NotFoundException(f"Product return voucher with ID '{return_id}' not found.")

            supplier = await supplier_repository.get_by_id(db, id=product_return.supplier_id)
            purchase = await purchase_repository.get_by_id(db, id=product_return.purchase_id) if product_return.purchase_id else None

            # 1. Revert previous return effects
            old_net_reduction = product_return.grand_total - product_return.refund_received

            # Restore product stock (increase stock back)
            for old_item in product_return.items:
                prod = await product_repository.get_by_id(db, id=old_item.product_id)
                if prod:
                    prod.current_stock += old_item.quantity
                    db.add(prod)

            # Restore supplier due & purchase due
            if supplier:
                supplier.current_balance += old_net_reduction
                db.add(supplier)
            if purchase:
                purchase.due_amount += old_net_reduction
                db.add(purchase)

            # 2. Process new items if provided
            if return_in.items is not None:
                for old_item in list(product_return.items):
                    await db.delete(old_item)
                await db.flush()

                prev_returns = {}
                if purchase:
                    prev_returns = await product_return_repository.get_previously_returned_quantities(
                        db, purchase.id, exclude_return_id=product_return.id
                    )

                new_grand_total = 0.0
                for item_in in return_in.items:
                    product = await product_repository.get_by_id(db, id=item_in.product_id)
                    if not product:
                        raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")

                    if item_in.quantity <= 0:
                        raise BadRequestException("Returned quantity must be greater than zero.")

                    if purchase:
                        matching_item = next((pi for pi in purchase.items if pi.product_id == item_in.product_id), None)
                        if not matching_item:
                            raise BadRequestException(f"Product '{product.name}' was not part of original Purchase order.")
                        prev_returned = prev_returns.get(item_in.product_id, 0.0)
                        returnable_qty = max(0.0, matching_item.quantity - prev_returned)
                        if item_in.quantity > returnable_qty:
                            raise BadRequestException(
                                f"Returned quantity ({item_in.quantity}) for product '{product.name}' exceeds returnable limit ({returnable_qty})."
                            )

                    # Check stock availability (after old stock was restored)
                    if product.current_stock < item_in.quantity:
                        raise BadRequestException(
                            f"Insufficient stock for product '{product.name}'. Available: {product.current_stock}, Returning: {item_in.quantity}."
                        )

                    item_total = item_in.quantity * item_in.unit_price
                    new_grand_total += item_total

                    ret_item = ProductReturnItem(
                        product_return_id=product_return.id,
                        product_id=product.id,
                        quantity=item_in.quantity,
                        unit_price=item_in.unit_price,
                        total_price=item_total,
                    )
                    db.add(ret_item)

                    # Decrease stock with new return quantity
                    product.current_stock -= item_in.quantity
                    db.add(product)

                product_return.grand_total = round(new_grand_total, 2)

            if return_in.refund_received is not None:
                product_return.refund_received = return_in.refund_received
            if return_in.reason is not None:
                product_return.reason = return_in.reason

            db.add(product_return)

            # 3. Apply new supplier due & purchase due adjustments
            new_net_reduction = product_return.grand_total - product_return.refund_received
            if supplier:
                supplier.current_balance -= new_net_reduction
                db.add(supplier)

            if purchase:
                purchase.due_amount = max(0.0, round(purchase.due_amount - new_net_reduction, 2))
                if purchase.due_amount <= 0:
                    purchase.payment_status = "paid"
                elif purchase.paid_amount > 0:
                    purchase.payment_status = "partial"
                db.add(purchase)

            # 4. Activity Log
            log_payload = json.dumps({
                "return_no": product_return.return_no,
                "updated_grand_total": product_return.grand_total,
                "updated_refund": product_return.refund_received,
                "new_supplier_due": supplier.current_balance if supplier else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="product_return.edit",
                entity_type="product_return",
                entity_id=product_return.id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.commit()
            return await self.get_product_return(db, product_return.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update product return '{return_id}': {str(e)}")
            raise e

    async def delete_product_return(self, db: AsyncSession, user_id: str, return_id: str) -> bool:
        """
        Deletes a Product Return voucher inside a single database transaction.
        Restores product stock (+qty) and restores supplier due & purchase due balances.
        """
        try:
            product_return = await product_return_repository.get_by_id(db, id=return_id)
            if not product_return:
                raise NotFoundException(f"Product return voucher with ID '{return_id}' not found.")

            supplier = await supplier_repository.get_by_id(db, id=product_return.supplier_id)
            purchase = await purchase_repository.get_by_id(db, id=product_return.purchase_id) if product_return.purchase_id else None

            net_reduction = product_return.grand_total - product_return.refund_received

            # 1. Restore product stock (increase stock back)
            for item in product_return.items:
                product = await product_repository.get_by_id(db, id=item.product_id)
                if product:
                    product.current_stock += item.quantity
                    db.add(product)

            # 2. Restore supplier due & purchase due
            if supplier:
                supplier.current_balance += net_reduction
                db.add(supplier)

            if purchase:
                purchase.due_amount += net_reduction
                if purchase.due_amount > 0 and purchase.paid_amount < purchase.grand_total:
                    purchase.payment_status = "partial" if purchase.paid_amount > 0 else "unpaid"
                db.add(purchase)

            # 3. Activity Log
            log_payload = json.dumps({
                "return_no": product_return.return_no,
                "deleted_amount": product_return.grand_total,
                "restored_supplier_due": supplier.current_balance if supplier else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="product_return.delete",
                entity_type="product_return",
                entity_id=return_id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 4. Delete voucher
            await db.delete(product_return)

            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete product return '{return_id}': {str(e)}")
            raise e

    async def get_product_return(self, db: AsyncSession, return_id: str) -> ProductReturn:
        product_return = await product_return_repository.get_by_id(db, id=return_id)
        if not product_return:
            raise NotFoundException(f"Product return voucher with ID '{return_id}' not found.")
        return product_return

    async def get_product_returns_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        purchase_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[ProductReturn], int]:
        return await product_return_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            supplier_id=supplier_id,
            purchase_id=purchase_id,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
        )

    async def get_product_return_reports(
        self,
        db: AsyncSession,
        *,
        preset_range: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)
        if preset_range == "today":
            start_date = datetime.combine(now_utc.date(), datetime.min.time(), tzinfo=timezone.utc)
            end_date = datetime.combine(now_utc.date(), datetime.max.time(), tzinfo=timezone.utc)
        elif preset_range == "yesterday":
            y_date = now_utc.date() - timedelta(days=1)
            start_date = datetime.combine(y_date, datetime.min.time(), tzinfo=timezone.utc)
            end_date = datetime.combine(y_date, datetime.max.time(), tzinfo=timezone.utc)
        elif preset_range == "this_week":
            w_start = now_utc.date() - timedelta(days=now_utc.weekday())
            start_date = datetime.combine(w_start, datetime.min.time(), tzinfo=timezone.utc)
            end_date = datetime.combine(now_utc.date(), datetime.max.time(), tzinfo=timezone.utc)
        elif preset_range == "this_month":
            m_start = now_utc.date().replace(day=1)
            start_date = datetime.combine(m_start, datetime.min.time(), tzinfo=timezone.utc)
            end_date = datetime.combine(now_utc.date(), datetime.max.time(), tzinfo=timezone.utc)

        return await product_return_repository.get_report_data(
            db,
            start_date=start_date,
            end_date=end_date,
            search=search,
            supplier_id=supplier_id,
        )


product_return_service = ProductReturnService()
