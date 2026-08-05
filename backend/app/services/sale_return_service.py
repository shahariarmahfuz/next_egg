import json
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.repositories.customer_repository import customer_repository
from app.repositories.product_repository import product_repository
from app.repositories.sale_repository import sale_repository
from app.repositories.sale_return_repository import sale_return_repository
from app.schemas.sale_return import (
    SaleReturnCreate,
    SaleReturnUpdate,
)


class SaleReturnService:
    async def get_sale_returnable_info(self, db: AsyncSession, sale_identifier: str) -> dict:
        """
        Fetches sale invoice info along with previously returned and remaining returnable quantities for each item.
        """
        # Try fetching by UUID or invoice_no
        sale = await sale_repository.get_by_id(db, id=sale_identifier)
        if not sale:
            sale = await sale_repository.get_by_invoice_no(db, invoice_no=sale_identifier.strip())
        if not sale:
            raise NotFoundException(f"Sale invoice '{sale_identifier}' not found.")

        customer = await customer_repository.get_by_id(db, id=sale.customer_id)

        # Get previously returned quantities for this sale
        prev_returns = await sale_return_repository.get_previously_returned_quantities(db, sale.id)

        returnable_items = []
        for item in sale.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            prev_returned_qty = prev_returns.get(item.product_id, 0.0)
            returnable_qty = max(0.0, item.quantity - prev_returned_qty)

            returnable_items.append({
                "product_id": item.product_id,
                "product_name": product.name if product else "Unknown Product",
                "product_code": product.product_code if product else "",
                "unit": product.unit if product else "pcs",
                "sold_quantity": item.quantity,
                "previously_returned_qty": prev_returned_qty,
                "returnable_qty": returnable_qty,
                "unit_price": item.unit_price,
            })

        return {
            "sale_id": sale.id,
            "invoice_no": sale.invoice_no,
            "sale_date": sale.sale_date,
            "customer_id": sale.customer_id,
            "customer_name": customer.name if customer else "N/A",
            "customer_phone": customer.phone if customer else "",
            "customer_code": customer.customer_code if customer else "",
            "grand_total": sale.grand_total,
            "paid_amount": sale.paid_amount,
            "due_amount": sale.due_amount,
            "items": returnable_items,
        }

    async def create_sale_return(
        self, db: AsyncSession, user_id: str, return_in: SaleReturnCreate
    ) -> SaleReturn:
        """
        Creates a new Sale Return voucher inside a single database transaction.
        - Automatically updates product stock (+qty).
        - Recalculates customer current due balance (- (grand_total - refund_amount)).
        - Recalculates linked sale due_amount & status.
        - Enforces returnable quantity constraints.
        """
        try:
            # 1. Validate Customer
            customer = await customer_repository.get_by_id(db, id=return_in.customer_id)
            if not customer:
                raise NotFoundException(f"Customer with ID '{return_in.customer_id}' not found.")

            # 2. Validate Sale if linked
            sale = None
            prev_returns = {}
            if return_in.sale_id:
                sale = await sale_repository.get_by_id(db, id=return_in.sale_id)
                if not sale:
                    raise NotFoundException(f"Linked Sale with ID '{return_in.sale_id}' not found.")
                prev_returns = await sale_return_repository.get_previously_returned_quantities(db, sale.id)

            # 3. Process Return Items & Enforce Returnable Quantity Rule
            prepared_items = []
            return_grand_total = 0.0

            for item_in in return_in.items:
                product = await product_repository.get_by_id(db, id=item_in.product_id)
                if not product:
                    raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")

                if item_in.quantity <= 0:
                    raise BadRequestException(f"Return quantity for product '{product.name}' must be greater than zero.")

                # If linked to a sale, check against original sale item quantity
                if sale:
                    matching_sale_item = next((si for si in sale.items if si.product_id == item_in.product_id), None)
                    if not matching_sale_item:
                        raise BadRequestException(
                            f"Product '{product.name}' was not part of original Sale invoice {sale.invoice_no}."
                        )
                    prev_returned = prev_returns.get(item_in.product_id, 0.0)
                    returnable_qty = max(0.0, matching_sale_item.quantity - prev_returned)
                    if item_in.quantity > returnable_qty:
                        raise BadRequestException(
                            f"Return quantity ({item_in.quantity}) for product '{product.name}' "
                            f"exceeds remaining returnable quantity ({returnable_qty})."
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
            if return_in.refund_amount > return_grand_total:
                raise BadRequestException(
                    f"Refund amount (${return_in.refund_amount:.2f}) cannot exceed return total (${return_grand_total:.2f})."
                )

            # 4. Generate Voucher Number
            return_no = await sale_return_repository.generate_return_no(db)
            ret_date = return_in.return_date or datetime.now(timezone.utc)

            # 5. Create Return Header
            sale_return = SaleReturn(
                return_no=return_no,
                sale_id=return_in.sale_id,
                customer_id=customer.id,
                user_id=user_id,
                return_date=ret_date,
                grand_total=return_grand_total,
                refund_amount=return_in.refund_amount,
                reason=return_in.reason,
            )
            db.add(sale_return)
            await db.flush()

            # 6. Create Return Items & Automatically Increase Product Stock
            for item_data in prepared_items:
                ret_item = SaleReturnItem(
                    sale_return_id=sale_return.id,
                    product_id=item_data["product_id"],
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    total_price=item_data["total_price"],
                )
                db.add(ret_item)

                # INCREASE PRODUCT STOCK
                product = item_data["product_model"]
                product.current_stock += item_data["quantity"]
                db.add(product)

            # 7. Recalculate Customer Due & Sale Due Summary
            credit_adjustment = return_grand_total - return_in.refund_amount
            customer.current_balance -= credit_adjustment
            db.add(customer)

            if sale:
                sale.due_amount = max(0.0, round(sale.due_amount - credit_adjustment, 2))
                if sale.due_amount <= 0:
                    sale.payment_status = "paid"
                elif sale.paid_amount > 0:
                    sale.payment_status = "partial"
                db.add(sale)

            # 8. Activity Audit Log
            log_payload = json.dumps({
                "return_no": return_no,
                "sale_id": return_in.sale_id,
                "customer_id": customer.id,
                "grand_total": return_grand_total,
                "refund_amount": return_in.refund_amount,
                "credit_adjustment": credit_adjustment,
                "updated_customer_due": customer.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="sale_return.create",
                entity_type="sale_return",
                entity_id=sale_return.id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 9. Single Atomic Transaction Commit
            await db.commit()

            return await self.get_sale_return(db, sale_return.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create sale return: {str(e)}")
            raise e

    async def update_sale_return(
        self, db: AsyncSession, user_id: str, return_id: str, return_in: SaleReturnUpdate
    ) -> SaleReturn:
        """
        Updates an existing Sale Return inside a single database transaction.
        Reverts old stock & balance effects, applies new parameters, and recalculates all totals.
        """
        try:
            sale_return = await sale_return_repository.get_by_id(db, id=return_id)
            if not sale_return:
                raise NotFoundException(f"Sale return voucher with ID '{return_id}' not found.")

            customer = await customer_repository.get_by_id(db, id=sale_return.customer_id)
            sale = await sale_repository.get_by_id(db, id=sale_return.sale_id) if sale_return.sale_id else None

            # 1. Revert previous return effects
            old_credit = sale_return.grand_total - sale_return.refund_amount

            # Revert product stock
            for old_item in sale_return.items:
                prod = await product_repository.get_by_id(db, id=old_item.product_id)
                if prod:
                    prod.current_stock -= old_item.quantity
                    db.add(prod)

            # Revert customer due & sale due
            if customer:
                customer.current_balance += old_credit
                db.add(customer)
            if sale:
                sale.due_amount += old_credit
                db.add(sale)

            # 2. Process new items if provided
            if return_in.items is not None:
                # Remove old items
                for old_item in list(sale_return.items):
                    await db.delete(old_item)
                await db.flush()

                prev_returns = {}
                if sale:
                    prev_returns = await sale_return_repository.get_previously_returned_quantities(
                        db, sale.id, exclude_return_id=sale_return.id
                    )

                new_grand_total = 0.0
                for item_in in return_in.items:
                    product = await product_repository.get_by_id(db, id=item_in.product_id)
                    if not product:
                        raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")

                    if item_in.quantity <= 0:
                        raise BadRequestException("Returned quantity must be greater than zero.")

                    if sale:
                        matching_sale_item = next((si for si in sale.items if si.product_id == item_in.product_id), None)
                        if not matching_sale_item:
                            raise BadRequestException(f"Product '{product.name}' was not part of original Sale invoice.")
                        prev_returned = prev_returns.get(item_in.product_id, 0.0)
                        returnable_qty = max(0.0, matching_sale_item.quantity - prev_returned)
                        if item_in.quantity > returnable_qty:
                            raise BadRequestException(
                                f"Returned quantity ({item_in.quantity}) for product '{product.name}' exceeds returnable limit ({returnable_qty})."
                            )

                    item_total = item_in.quantity * item_in.unit_price
                    new_grand_total += item_total

                    ret_item = SaleReturnItem(
                        sale_return_id=sale_return.id,
                        product_id=product.id,
                        quantity=item_in.quantity,
                        unit_price=item_in.unit_price,
                        total_price=item_total,
                    )
                    db.add(ret_item)

                    # Increase stock with new return quantity
                    product.current_stock += item_in.quantity
                    db.add(product)

                sale_return.grand_total = round(new_grand_total, 2)

            if return_in.refund_amount is not None:
                sale_return.refund_amount = return_in.refund_amount
            if return_in.reason is not None:
                sale_return.reason = return_in.reason

            db.add(sale_return)

            # 3. Apply new customer due & sale due adjustments
            new_credit = sale_return.grand_total - sale_return.refund_amount
            if customer:
                customer.current_balance -= new_credit
                db.add(customer)

            if sale:
                sale.due_amount = max(0.0, round(sale.due_amount - new_credit, 2))
                if sale.due_amount <= 0:
                    sale.payment_status = "paid"
                elif sale.paid_amount > 0:
                    sale.payment_status = "partial"
                db.add(sale)

            # 4. Activity Log
            log_payload = json.dumps({
                "return_no": sale_return.return_no,
                "updated_grand_total": sale_return.grand_total,
                "updated_refund": sale_return.refund_amount,
                "new_customer_due": customer.current_balance if customer else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="sale_return.edit",
                entity_type="sale_return",
                entity_id=sale_return.id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.commit()
            return await self.get_sale_return(db, sale_return.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update sale return '{return_id}': {str(e)}")
            raise e

    async def delete_sale_return(self, db: AsyncSession, user_id: str, return_id: str) -> bool:
        """
        Deletes a Sale Return voucher inside a single database transaction.
        Reverts stock increase and restores customer due & sale due balances.
        """
        try:
            sale_return = await sale_return_repository.get_by_id(db, id=return_id)
            if not sale_return:
                raise NotFoundException(f"Sale return voucher with ID '{return_id}' not found.")

            customer = await customer_repository.get_by_id(db, id=sale_return.customer_id)
            sale = await sale_repository.get_by_id(db, id=sale_return.sale_id) if sale_return.sale_id else None

            credit_adjustment = sale_return.grand_total - sale_return.refund_amount

            # 1. Revert product stock (decrease stock back)
            for item in sale_return.items:
                product = await product_repository.get_by_id(db, id=item.product_id)
                if product:
                    product.current_stock -= item.quantity
                    db.add(product)

            # 2. Restore customer due & sale due
            if customer:
                customer.current_balance += credit_adjustment
                db.add(customer)

            if sale:
                sale.due_amount += credit_adjustment
                if sale.due_amount > 0 and sale.paid_amount < sale.grand_total:
                    sale.payment_status = "partial" if sale.paid_amount > 0 else "unpaid"
                db.add(sale)

            # 3. Activity Log
            log_payload = json.dumps({
                "return_no": sale_return.return_no,
                "deleted_amount": sale_return.grand_total,
                "restored_due": customer.current_balance if customer else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="sale_return.delete",
                entity_type="sale_return",
                entity_id=return_id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 4. Delete voucher
            await db.delete(sale_return)

            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete sale return '{return_id}': {str(e)}")
            raise e

    async def get_sale_return(self, db: AsyncSession, return_id: str) -> SaleReturn:
        sale_return = await sale_return_repository.get_by_id(db, id=return_id)
        if not sale_return:
            raise NotFoundException(f"Sale return voucher with ID '{return_id}' not found.")
        return sale_return

    async def get_sale_returns_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        sale_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[SaleReturn], int]:
        return await sale_return_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            customer_id=customer_id,
            sale_id=sale_id,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
        )

    async def get_sale_return_reports(
        self,
        db: AsyncSession,
        *,
        preset_range: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
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

        return await sale_return_repository.get_report_data(
            db,
            start_date=start_date,
            end_date=end_date,
            search=search,
            customer_id=customer_id,
        )


sale_return_service = SaleReturnService()
