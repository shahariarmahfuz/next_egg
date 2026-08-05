import json
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.repositories.supplier_payment_repository import supplier_payment_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.supplier_payment import (
    SupplierPaymentCreate,
    SupplierPaymentUpdate,
)


class SupplierPaymentService:
    async def get_supplier_financial_summary(self, db: AsyncSession, supplier_id: str) -> dict:
        summary = await supplier_payment_repository.get_supplier_financial_summary(db, supplier_id)
        if not summary:
            raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")
        return summary

    async def create_supplier_payment(
        self, db: AsyncSession, user_id: str, payment_in: SupplierPaymentCreate
    ) -> SupplierPayment:
        """
        Creates a new Supplier Payment voucher inside a single database transaction.
        - Enforces: payment_amount > 0 and payment_amount <= supplier.current_balance.
        - Automatically updates supplier.current_balance.
        - Logs activity to ActivityLog.
        """
        try:
            # 1. Validate Supplier
            supplier = await supplier_repository.get_by_id(db, id=payment_in.supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{payment_in.supplier_id}' not found.")

            # 2. Business Rules Validation
            if payment_in.amount <= 0:
                raise BadRequestException("Supplier payment amount must be greater than zero.")

            if payment_in.amount > supplier.current_balance:
                raise BadRequestException(
                    f"Payment amount (${payment_in.amount:.2f}) cannot exceed current supplier due balance (${supplier.current_balance:.2f})."
                )

            # 3. Generate Voucher Number
            payment_no = await supplier_payment_repository.generate_payment_no(db)
            pay_date = payment_in.payment_date or datetime.now(timezone.utc)

            # 4. Create Payment Voucher
            supplier_payment = SupplierPayment(
                payment_no=payment_no,
                supplier_id=supplier.id,
                purchase_id=payment_in.purchase_id,
                user_id=user_id,
                amount=payment_in.amount,
                payment_method=payment_in.payment_method,
                reference_no=payment_in.reference_no,
                payment_date=pay_date,
                notes=payment_in.notes,
            )
            db.add(supplier_payment)

            # 5. Automatically Update Supplier Current Due
            supplier.current_balance -= payment_in.amount
            db.add(supplier)

            # 6. Activity Audit Log
            log_payload = json.dumps({
                "payment_no": payment_no,
                "supplier_id": supplier.id,
                "amount": payment_in.amount,
                "payment_method": payment_in.payment_method,
                "updated_supplier_due": supplier.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_payment.create",
                entity_type="supplier_payment",
                entity_id=supplier_payment.id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 7. Single Atomic Transaction Commit
            await db.commit()

            return await self.get_supplier_payment(db, supplier_payment.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create supplier payment voucher: {str(e)}")
            raise e

    async def update_supplier_payment(
        self, db: AsyncSession, user_id: str, payment_id: str, payment_in: SupplierPaymentUpdate
    ) -> SupplierPayment:
        """
        Updates an existing Supplier Payment voucher inside a single database transaction.
        Automatically recalculates supplier due balance.
        """
        try:
            payment = await supplier_payment_repository.get_by_id(db, id=payment_id)
            if not payment:
                raise NotFoundException(f"Supplier payment voucher with ID '{payment_id}' not found.")

            supplier = await supplier_repository.get_by_id(db, id=payment.supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{payment.supplier_id}' not found.")

            # Recalculate amount if changed
            if payment_in.amount is not None:
                if payment_in.amount <= 0:
                    raise BadRequestException("Payment amount must be greater than zero.")

                old_amount = payment.amount
                new_amount = payment_in.amount

                max_allowed_payment = supplier.current_balance + old_amount
                if new_amount > max_allowed_payment:
                    raise BadRequestException(
                        f"Updated payment amount (${new_amount:.2f}) cannot exceed maximum allowed payment limit (${max_allowed_payment:.2f})."
                    )

                # Update supplier current_balance
                supplier.current_balance = supplier.current_balance + old_amount - new_amount
                payment.amount = new_amount
                db.add(supplier)

            if payment_in.payment_method is not None:
                payment.payment_method = payment_in.payment_method
            if payment_in.reference_no is not None:
                payment.reference_no = payment_in.reference_no
            if payment_in.payment_date is not None:
                payment.payment_date = payment_in.payment_date
            if payment_in.notes is not None:
                payment.notes = payment_in.notes

            db.add(payment)

            # Activity Log
            log_payload = json.dumps({
                "payment_no": payment.payment_no,
                "updated_amount": payment.amount,
                "new_supplier_due": supplier.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_payment.edit",
                entity_type="supplier_payment",
                entity_id=payment.id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.commit()
            return await self.get_supplier_payment(db, payment.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update supplier payment voucher '{payment_id}': {str(e)}")
            raise e

    async def delete_supplier_payment(self, db: AsyncSession, user_id: str, payment_id: str) -> bool:
        """
        Deletes a Supplier Payment voucher inside a single database transaction.
        Automatically restores the supplier's due balance.
        """
        try:
            payment = await supplier_payment_repository.get_by_id(db, id=payment_id)
            if not payment:
                raise NotFoundException(f"Supplier payment voucher with ID '{payment_id}' not found.")

            supplier = await supplier_repository.get_by_id(db, id=payment.supplier_id)

            # Restore supplier current due
            if supplier:
                supplier.current_balance += payment.amount
                db.add(supplier)

            # Activity Log
            log_payload = json.dumps({
                "payment_no": payment.payment_no,
                "deleted_amount": payment.amount,
                "restored_supplier_due": supplier.current_balance if supplier else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_payment.delete",
                entity_type="supplier_payment",
                entity_id=payment_id,
                payload=log_payload,
            )
            db.add(log_entry)

            # Delete voucher
            await db.delete(payment)

            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete supplier payment voucher '{payment_id}': {str(e)}")
            raise e

    async def get_supplier_payment(self, db: AsyncSession, payment_id: str) -> SupplierPayment:
        payment = await supplier_payment_repository.get_by_id(db, id=payment_id)
        if not payment:
            raise NotFoundException(f"Supplier payment voucher with ID '{payment_id}' not found.")
        return payment

    async def get_supplier_payments_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[SupplierPayment], int]:
        return await supplier_payment_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            supplier_id=supplier_id,
            payment_method=payment_method,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
        )

    async def get_supplier_payment_reports(
        self,
        db: AsyncSession,
        *,
        preset_range: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        payment_method: Optional[str] = None,
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

        return await supplier_payment_repository.get_report_data(
            db,
            start_date=start_date,
            end_date=end_date,
            search=search,
            supplier_id=supplier_id,
            payment_method=payment_method,
        )


supplier_payment_service = SupplierPaymentService()
