from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.customer import Customer
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.repositories.customer_repository import customer_repository
from app.repositories.product_repository import product_repository
from app.repositories.sale_repository import sale_repository
from app.schemas.sale import SaleCreate, SaleItemCreate, SaleUpdate


class SaleService:
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
        subtotal = 0.0

        for item_in in sale_in.items:
            product = await product_repository.get_by_id(db, id=item_in.product_id)
            if not product:
                raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")
            if product.status != "active":
                raise BadRequestException(f"Product '{product.name}' is inactive and cannot be sold.")

            # NON-NEGATIVE STOCK RULE
            if product.current_stock < item_in.quantity:
                raise BadRequestException(
                    f"Insufficient stock for product '{product.name}'. "
                    f"Requested: {item_in.quantity} {product.unit}, Available: {product.current_stock} {product.unit}."
                )

            item_total = (item_in.quantity * item_in.unit_price) - item_in.discount
            if item_total < 0:
                item_total = 0.0

            subtotal += item_total

            prepared_items.append({
                "product_id": product.id,
                "quantity": item_in.quantity,
                "unit_price": item_in.unit_price,
                "discount": item_in.discount,
                "total_price": item_total,
                "product_model": product,
            })

        # 4. Financial Calculations
        grand_total = subtotal - sale_in.discount_amount + sale_in.tax_amount
        if grand_total < 0:
            grand_total = 0.0

        due_amount = grand_total - sale_in.paid_amount
        if due_amount <= 0:
            due_amount = 0.0
            payment_status = "paid"
        elif sale_in.paid_amount > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        sale_date = sale_in.sale_date or datetime.now(timezone.utc)

        # 5. Atomic Transaction: Create Sale Header
        sale = Sale(
            invoice_no=inv_no,
            customer_id=customer.id,
            user_id=user_id,
            sale_date=sale_date,
            subtotal=subtotal,
            discount_amount=sale_in.discount_amount,
            tax_amount=sale_in.tax_amount,
            grand_total=grand_total,
            paid_amount=sale_in.paid_amount,
            due_amount=due_amount,
            payment_status=payment_status,
            notes=sale_in.notes,
        )
        db.add(sale)
        await db.flush()

        # 6. Create Line Items and Decrease Product Stock
        for item_data in prepared_items:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item_data["product_id"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                discount=item_data["discount"],
                total_price=item_data["total_price"],
            )
            db.add(sale_item)

            # DECREASE PRODUCT STOCK
            product = item_data["product_model"]
            product.current_stock -= item_data["quantity"]
            db.add(product)

        # 7. Update Customer Current Balance (Increase Receivable Due)
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
        if sale_in.notes is not None:
            sale.notes = sale_in.notes

        # Process Line Items Update if provided
        if sale_in.items is not None:
            # 1. Restore product stock from previous line items
            for old_item in sale.items:
                product = await product_repository.get_by_id(db, id=old_item.product_id)
                if product:
                    product.current_stock += old_item.quantity
                    db.add(product)

            # 2. Clear old items
            sale.items.clear()
            await db.flush()

            # 3. Process new items and validate stock availability
            subtotal = 0.0
            for item_in in sale_in.items:
                product = await product_repository.get_by_id(db, id=item_in.product_id)
                if not product:
                    raise NotFoundException(f"Product with ID '{item_in.product_id}' not found.")

                if product.current_stock < item_in.quantity:
                    raise BadRequestException(
                        f"Insufficient stock for product '{product.name}'. "
                        f"Requested: {item_in.quantity} {product.unit}, Available: {product.current_stock} {product.unit}."
                    )

                item_total = (item_in.quantity * item_in.unit_price) - item_in.discount
                if item_total < 0:
                    item_total = 0.0

                subtotal += item_total

                sale_item = SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=item_in.quantity,
                    unit_price=item_in.unit_price,
                    discount=item_in.discount,
                    total_price=item_total,
                )
                db.add(sale_item)

                # Deduct new stock
                product.current_stock -= item_in.quantity
                db.add(product)

            sale.subtotal = subtotal

        # Financial Calculations Update
        discount_amt = sale_in.discount_amount if sale_in.discount_amount is not None else sale.discount_amount
        tax_amt = sale_in.tax_amount if sale_in.tax_amount is not None else sale.tax_amount
        paid_amt = sale_in.paid_amount if sale_in.paid_amount is not None else sale.paid_amount

        sale.discount_amount = discount_amt
        sale.tax_amount = tax_amt
        sale.paid_amount = paid_amt

        grand_total = sale.subtotal - discount_amt + tax_amt
        sale.grand_total = max(0.0, grand_total)

        new_due = max(0.0, sale.grand_total - paid_amt)
        sale.due_amount = new_due

        if new_due <= 0:
            sale.payment_status = "paid"
        elif paid_amt > 0:
            sale.payment_status = "partial"
        else:
            sale.payment_status = "unpaid"

        db.add(sale)

        # Update Customer Balance Differences
        if old_customer_id == sale.customer_id:
            customer = await customer_repository.get_by_id(db, id=sale.customer_id)
            if customer:
                customer.current_balance += (new_due - old_due)
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

        # 1. Restore Product Current Stock
        for item in sale.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            if product:
                product.current_stock += item.quantity
                db.add(product)

        # 2. Adjust Customer Due Balance
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

        # 3. Restore Product Current Stock
        for item in sale.items:
            product = await product_repository.get_by_id(db, id=item.product_id)
            if product:
                product.current_stock += item.quantity
                db.add(product)

        # 4. Adjust Customer Due Balance
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
