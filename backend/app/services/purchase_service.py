from datetime import datetime, timezone, timedelta
from typing import Optional, Sequence
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.supplier import Supplier
from app.models.user import User
from app.repositories.product_repository import product_repository
from app.repositories.purchase_repository import purchase_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.purchase import PurchaseCreate, PurchaseReportSummary, PurchaseResponse, PurchaseUpdate


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

        subtotal = 0.0
        purchase_items: list[PurchaseItem] = []

        # Process each purchase line item and INCREASE stock
        for item_data in purchase_in.items:
            product = await product_repository.get_by_id(db, id=item_data.product_id)
            if not product:
                raise NotFoundException(f"Product with ID '{item_data.product_id}' not found.")

            line_total = (item_data.quantity * item_data.unit_price) - item_data.discount
            if line_total < 0:
                line_total = 0.0
            subtotal += line_total

            # AUTOMATICALLY INCREASE PRODUCT STOCK
            product.current_stock += item_data.quantity
            db.add(product)

            p_item = PurchaseItem(
                product_id=product.id,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                discount=item_data.discount,
                total_price=line_total,
            )
            purchase_items.append(p_item)

        # Financial Calculations
        grand_total = subtotal - purchase_in.discount_amount + purchase_in.tax_amount
        if grand_total < 0:
            grand_total = 0.0

        paid = purchase_in.paid_amount
        if paid > grand_total:
            paid = grand_total

        due = grand_total - paid
        if due <= 0:
            payment_status = "paid"
            due = 0.0
        elif paid > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        purchase = Purchase(
            purchase_no=code,
            invoice_no=purchase_in.invoice_no,
            supplier_id=supplier.id,
            user_id=user_id,
            purchase_date=purchase_in.purchase_date or datetime.now(timezone.utc),
            subtotal=subtotal,
            discount_amount=purchase_in.discount_amount,
            tax_amount=purchase_in.tax_amount,
            grand_total=grand_total,
            paid_amount=paid,
            due_amount=due,
            payment_status=payment_status,
            notes=purchase_in.notes,
            items=purchase_items,
        )

        db.add(purchase)
        await db.flush()
        return await purchase_repository.get_by_id_loaded(db, purchase.id) or purchase

    async def update_purchase(
        self, db: AsyncSession, purchase_id: str, purchase_in: PurchaseUpdate
    ) -> Purchase:
        """
        Updates purchase order and recalculates product stock levels safely.
        Validates non-negative stock rule.
        """
        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase order with ID '{purchase_id}' not found.")

        # Update basic fields if items are not modified
        if purchase_in.items is None:
            update_data = purchase_in.model_dump(exclude_unset=True)
            return await purchase_repository.update(db, db_obj=purchase, obj_in=update_data)

        # Re-evaluate stock changes
        # Step 1: Revert previous stock increases
        for old_item in purchase.items:
            product = await product_repository.get_by_id(db, id=old_item.product_id)
            if product:
                product.current_stock -= old_item.quantity
                if product.current_stock < 0:
                    raise BadRequestException(
                        f"Cannot update purchase: reverting stock for product '{product.name}' would cause negative stock ({product.current_stock})."
                    )
                db.add(product)

        # Step 2: Apply new items and increase stock
        subtotal = 0.0
        new_items: list[PurchaseItem] = []

        for item_data in purchase_in.items:
            product = await product_repository.get_by_id(db, id=item_data.product_id)
            if not product:
                raise NotFoundException(f"Product with ID '{item_data.product_id}' not found.")

            line_total = (item_data.quantity * item_data.unit_price) - item_data.discount
            if line_total < 0:
                line_total = 0.0
            subtotal += line_total

            product.current_stock += item_data.quantity
            db.add(product)

            new_items.append(
                PurchaseItem(
                    product_id=product.id,
                    quantity=item_data.quantity,
                    unit_price=item_data.unit_price,
                    discount=item_data.discount,
                    total_price=line_total,
                )
            )

        # Clear old items & replace
        purchase.items.clear()
        purchase.items = new_items

        # Recalculate financial totals
        discount_amount = purchase_in.discount_amount if purchase_in.discount_amount is not None else purchase.discount_amount
        tax_amount = purchase_in.tax_amount if purchase_in.tax_amount is not None else purchase.tax_amount
        paid_amount = purchase_in.paid_amount if purchase_in.paid_amount is not None else purchase.paid_amount

        grand_total = subtotal - discount_amount + tax_amount
        if grand_total < 0:
            grand_total = 0.0

        if paid_amount > grand_total:
            paid_amount = grand_total

        due = grand_total - paid_amount
        if due <= 0:
            payment_status = "paid"
            due = 0.0
        elif paid_amount > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        purchase.subtotal = subtotal
        purchase.discount_amount = discount_amount
        purchase.tax_amount = tax_amount
        purchase.grand_total = grand_total
        purchase.paid_amount = paid_amount
        purchase.due_amount = due
        purchase.payment_status = payment_status

        if purchase_in.invoice_no is not None:
            purchase.invoice_no = purchase_in.invoice_no
        if purchase_in.notes is not None:
            purchase.notes = purchase_in.notes

        db.add(purchase)
        await db.flush()
        return await purchase_repository.get_by_id_loaded(db, purchase.id) or purchase

    async def delete_purchase(self, db: AsyncSession, purchase_id: str) -> bool:
        """
        Deletes a purchase order and REDUCES product stock automatically.
        Validates non-negative stock rule before allowing deletion.
        """
        purchase = await purchase_repository.get_by_id_loaded(db, purchase_id)
        if not purchase:
            raise NotFoundException(f"Purchase order with ID '{purchase_id}' not found.")

        # Reduce product stock & check non-negative safety
        for item in purchase.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            if product:
                product.current_stock -= item.quantity
                if product.current_stock < 0:
                    raise BadRequestException(
                        f"Cannot delete purchase order: stock for product '{product.name}' has already been consumed ({product.current_stock})."
                    )
                db.add(product)

        await db.delete(purchase)
        await db.commit()
        return True

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
            start_date=start_date,
            end_date=end_date,
        )

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

        for item in purchase.items:
            product = await product_repository.get_by_id(db, item.product_id)
            if product:
                product.current_stock -= item.quantity
                db.add(product)

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

        await db.execute(delete(SupplierPayment).where(SupplierPayment.purchase_id == purchase_id))

        for item in purchase.items:
            product = await product_repository.get_by_id(db, item.product_id)
            if product:
                product.current_stock -= item.quantity
                db.add(product)

        supplier = await supplier_repository.get_by_id(db, purchase.supplier_id)
        if supplier:
            supplier.current_balance -= purchase.due_amount
            db.add(supplier)

        await db.delete(purchase)
        await db.commit()
        return True


purchase_service = PurchaseService()
