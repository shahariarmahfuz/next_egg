import json
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.supplier import Supplier
from app.models.supplier_other_transaction import SupplierOtherTransaction
from app.repositories.supplier_other_transaction_repository import (
    supplier_other_transaction_repository,
)
from app.repositories.supplier_repository import supplier_repository
from app.schemas.supplier_other_transaction import (
    SupplierOtherTransactionCreate,
    SupplierOtherTransactionUpdate,
)


class SupplierOtherTransactionService:
    async def create_transaction(
        self, db: AsyncSession, user_id: str, tx_in: SupplierOtherTransactionCreate
    ) -> SupplierOtherTransaction:
        """
        Creates a new Supplier Other Transaction (Other Payable) inside an atomic transaction.
        - Other Payable represents money received from a supplier outside normal purchases.
        - Automatically increases supplier.current_balance (current payable due).
        - Generates SOT voucher number.
        - Creates audit ActivityLog entry.
        """
        try:
            # 1. Validate Supplier
            supplier = await supplier_repository.get_by_id(db, id=tx_in.supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{tx_in.supplier_id}' not found.")

            # 2. Business Rules Validation
            if tx_in.amount <= 0:
                raise BadRequestException("Transaction amount must be greater than zero.")

            # 3. Generate Voucher Number
            voucher_no = await supplier_other_transaction_repository.generate_voucher_no(db)
            tx_date = tx_in.transaction_date or datetime.now(timezone.utc)

            # 4. Create Entity
            other_tx = SupplierOtherTransaction(
                voucher_no=voucher_no,
                supplier_id=supplier.id,
                user_id=user_id,
                transaction_type=tx_in.transaction_type or "other_payable",
                amount=tx_in.amount,
                transaction_date=tx_date,
                reference_no=tx_in.reference_no.strip() if tx_in.reference_no and tx_in.reference_no.strip() else None,
                notes=tx_in.notes.strip() if tx_in.notes and tx_in.notes.strip() else None,
            )
            db.add(other_tx)

            # 5. Automatically Update Supplier Payable Due (+amount)
            # When receiving money (other_payable), our debt to the supplier increases
            supplier.current_balance += tx_in.amount
            db.add(supplier)

            # 6. Activity Audit Log
            log_payload = json.dumps({
                "voucher_no": voucher_no,
                "supplier_id": supplier.id,
                "transaction_type": other_tx.transaction_type,
                "amount": tx_in.amount,
                "updated_supplier_due": supplier.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_other_transaction.create",
                entity_type="supplier_other_transaction",
                entity_id=other_tx.id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 7. Atomic Commit
            await db.commit()

            return await self.get_transaction(db, other_tx.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create supplier other transaction: {str(e)}")
            raise e

    async def get_transaction(self, db: AsyncSession, tx_id: str) -> SupplierOtherTransaction:
        query = (
            select(SupplierOtherTransaction)
            .options(
                selectinload(SupplierOtherTransaction.supplier),
                selectinload(SupplierOtherTransaction.user),
            )
            .where(SupplierOtherTransaction.id == tx_id)
        )
        res = await db.execute(query)
        tx = res.scalars().first()
        if not tx:
            raise NotFoundException(f"Supplier other transaction with ID '{tx_id}' not found.")
        return tx

    async def get_transactions_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[str] = None,
        transaction_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[Sequence[SupplierOtherTransaction], int]:
        return await supplier_other_transaction_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            supplier_id=supplier_id,
            transaction_type=transaction_type,
            start_date=start_date,
            end_date=end_date,
        )

    async def update_transaction(
        self, db: AsyncSession, user_id: str, tx_id: str, tx_in: SupplierOtherTransactionUpdate
    ) -> SupplierOtherTransaction:
        """
        Updates an existing Supplier Other Transaction inside an atomic database transaction.
        - Automatically reverses old accounting effect and applies new transaction values.
        - Recalculates supplier.current_balance accurately.
        - Logs activity to ActivityLog.
        """
        try:
            tx = await self.get_transaction(db, tx_id)
            supplier = await supplier_repository.get_by_id(db, id=tx.supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{tx.supplier_id}' not found.")

            if tx_in.amount is not None:
                if tx_in.amount <= 0:
                    raise BadRequestException("Transaction amount must be greater than zero.")
                old_amount = tx.amount
                new_amount = tx_in.amount

                # Reverse old effect (-old_amount) and apply new effect (+new_amount)
                supplier.current_balance = round(supplier.current_balance - old_amount + new_amount, 2)
                tx.amount = new_amount
                db.add(supplier)

            if tx_in.transaction_date is not None:
                tx.transaction_date = tx_in.transaction_date
            if tx_in.reference_no is not None:
                tx.reference_no = tx_in.reference_no.strip() if tx_in.reference_no.strip() else None
            if tx_in.notes is not None:
                tx.notes = tx_in.notes.strip() if tx_in.notes.strip() else None

            db.add(tx)

            # Activity Log
            log_payload = json.dumps({
                "voucher_no": tx.voucher_no,
                "supplier_id": supplier.id,
                "updated_amount": tx.amount,
                "new_supplier_due": supplier.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_other_transaction.edit",
                entity_type="supplier_other_transaction",
                entity_id=tx.id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.commit()
            return await self.get_transaction(db, tx.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update supplier other transaction '{tx_id}': {str(e)}")
            raise e

    async def delete_transaction(self, db: AsyncSession, user_id: str, tx_id: str) -> bool:
        """
        Deletes a Supplier Other Transaction and reverses its impact on supplier balance.
        """
        try:
            tx = await self.get_transaction(db, tx_id)
            supplier = await supplier_repository.get_by_id(db, id=tx.supplier_id)

            if supplier:
                # Reverse debt addition
                supplier.current_balance = round(supplier.current_balance - tx.amount, 2)
                db.add(supplier)

            log_payload = json.dumps({
                "voucher_no": tx.voucher_no,
                "deleted_amount": tx.amount,
                "restored_supplier_due": supplier.current_balance if supplier else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="supplier_other_transaction.delete",
                entity_type="supplier_other_transaction",
                entity_id=tx_id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.delete(tx)
            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete supplier other transaction '{tx_id}': {str(e)}")
            raise e


supplier_other_transaction_service = SupplierOtherTransactionService()
