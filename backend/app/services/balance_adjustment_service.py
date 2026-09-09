import json
from datetime import datetime, timezone
from typing import Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.balance_adjustment import BalanceAdjustment
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.user import User
from app.repositories.customer_repository import customer_repository
from app.repositories.supplier_repository import supplier_repository
from app.schemas.balance_adjustment import BalanceAdjustmentCreate


class BalanceAdjustmentService:
    async def adjust_customer_balance(
        self,
        db: AsyncSession,
        user: User,
        customer_id: str,
        adj_in: BalanceAdjustmentCreate,
    ) -> BalanceAdjustment:
        """
        Sets a customer's current balance directly by recording an immutable BalanceAdjustment.
        Does NOT alter or delete previous invoices, collections, or sales history.
        """
        try:
            customer = await customer_repository.get_by_id(db, id=customer_id)
            if not customer:
                raise NotFoundException(f"Customer with ID '{customer_id}' not found.")

            previous_balance = customer.current_balance
            new_balance = adj_in.new_balance
            difference = new_balance - previous_balance

            effective_dt = adj_in.effective_date or datetime.now(timezone.utc)

            # Create Balance Adjustment Audit Record
            adjustment = BalanceAdjustment(
                entity_type="customer",
                entity_id=customer_id,
                previous_balance=previous_balance,
                new_balance=new_balance,
                difference=difference,
                balance_type=adj_in.balance_type,
                effective_date=effective_dt,
                reason=adj_in.reason,
                notes=adj_in.notes,
                created_by_user_id=user.id,
                created_by_user_name=user.full_name or user.username,
            )
            db.add(adjustment)
            await db.flush()

            # Update customer current balance
            customer.current_balance = new_balance
            db.add(customer)

            # Write Activity Log
            log_payload = json.dumps({
                "adjustment_id": adjustment.id,
                "customer_id": customer_id,
                "customer_code": customer.customer_code,
                "previous_balance": previous_balance,
                "new_balance": new_balance,
                "difference": difference,
                "reason": adj_in.reason,
            })
            activity = ActivityLog(
                user_id=user.id,
                action="customer.balance.adjust",
                entity_type="customer",
                entity_id=customer_id,
                payload=log_payload,
            )
            db.add(activity)

            await db.commit()
            await db.refresh(adjustment)
            return adjustment

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to adjust customer balance: {str(e)}")
            raise e

    async def adjust_supplier_balance(
        self,
        db: AsyncSession,
        user: User,
        supplier_id: str,
        adj_in: BalanceAdjustmentCreate,
    ) -> BalanceAdjustment:
        """
        Sets a supplier's current balance directly by recording an immutable BalanceAdjustment.
        Does NOT alter or delete previous purchases, payments, or invoices.
        """
        try:
            supplier = await supplier_repository.get_by_id(db, id=supplier_id)
            if not supplier:
                raise NotFoundException(f"Supplier with ID '{supplier_id}' not found.")

            previous_balance = supplier.current_balance
            new_balance = adj_in.new_balance
            difference = new_balance - previous_balance

            effective_dt = adj_in.effective_date or datetime.now(timezone.utc)

            # Create Balance Adjustment Audit Record
            adjustment = BalanceAdjustment(
                entity_type="supplier",
                entity_id=supplier_id,
                previous_balance=previous_balance,
                new_balance=new_balance,
                difference=difference,
                balance_type=adj_in.balance_type,
                effective_date=effective_dt,
                reason=adj_in.reason,
                notes=adj_in.notes,
                created_by_user_id=user.id,
                created_by_user_name=user.full_name or user.username,
            )
            db.add(adjustment)
            await db.flush()

            # Update supplier current balance
            supplier.current_balance = new_balance
            db.add(supplier)

            # Write Activity Log
            log_payload = json.dumps({
                "adjustment_id": adjustment.id,
                "supplier_id": supplier_id,
                "supplier_code": supplier.supplier_code,
                "previous_balance": previous_balance,
                "new_balance": new_balance,
                "difference": difference,
                "reason": adj_in.reason,
            })
            activity = ActivityLog(
                user_id=user.id,
                action="supplier.balance.adjust",
                entity_type="supplier",
                entity_id=supplier_id,
                payload=log_payload,
            )
            db.add(activity)

            await db.commit()
            await db.refresh(adjustment)
            return adjustment

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to adjust supplier balance: {str(e)}")
            raise e

    async def get_adjustments_for_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: str,
    ) -> Sequence[BalanceAdjustment]:
        """
        Retrieves all balance adjustment audit history for a customer or supplier ordered by date descending.
        """
        query = (
            select(BalanceAdjustment)
            .where(
                BalanceAdjustment.entity_type == entity_type,
                BalanceAdjustment.entity_id == entity_id,
            )
            .order_by(BalanceAdjustment.created_at.desc())
        )
        res = await db.execute(query)
        return res.scalars().all()

    async def delete_customer_adjustment_history(
        self,
        db: AsyncSession,
        user: User,
        adjustment_id: str,
        customer_id: str | None = None,
    ) -> dict:
        """
        Deletes ONLY the customer balance adjustment history record.
        CRITICAL SAFETY:
        - Customer's current balance is strictly NOT changed, reversed, or recalculated.
        - Sales, returns, collections, payments, and financial transactions are untouched.
        - Only the BalanceAdjustment history record is removed.
        """
        try:
            query = select(BalanceAdjustment).where(
                BalanceAdjustment.id == adjustment_id,
                BalanceAdjustment.entity_type == "customer",
            )
            if customer_id:
                query = query.where(BalanceAdjustment.entity_id == customer_id)

            res = await db.execute(query)
            adjustment = res.scalars().first()

            if not adjustment:
                raise NotFoundException(
                    f"Customer balance adjustment record with ID '{adjustment_id}' not found."
                )

            target_customer_id = adjustment.entity_id

            # Audit Log for deletion of the history record
            log_payload = json.dumps({
                "adjustment_id": adjustment.id,
                "customer_id": target_customer_id,
                "previous_balance": adjustment.previous_balance,
                "new_balance": adjustment.new_balance,
                "difference": adjustment.difference,
                "reason": adjustment.reason,
                "action": "history_record_deleted",
            })
            activity = ActivityLog(
                user_id=user.id,
                action="customer.balance.adjustment.delete",
                entity_type="customer",
                entity_id=target_customer_id,
                payload=log_payload,
            )
            db.add(activity)

            # Delete ONLY the adjustment history record
            await db.delete(adjustment)

            # Customer current_balance is intentionally and strictly left unchanged
            await db.commit()

            return {
                "id": adjustment_id,
                "customer_id": target_customer_id,
                "deleted": True,
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete customer balance adjustment history: {str(e)}")
            raise e

    async def delete_supplier_adjustment_history(
        self,
        db: AsyncSession,
        user: User,
        adjustment_id: str,
        supplier_id: str | None = None,
    ) -> dict:
        """
        Deletes ONLY the supplier balance adjustment history record.
        CRITICAL SAFETY:
        - Supplier's current balance is strictly NOT changed, reversed, or recalculated.
        - Purchases, returns, payments, vouchers, and financial transactions are untouched.
        - Only the BalanceAdjustment history record is removed.
        """
        try:
            query = select(BalanceAdjustment).where(
                BalanceAdjustment.id == adjustment_id,
                BalanceAdjustment.entity_type == "supplier",
            )
            if supplier_id:
                query = query.where(BalanceAdjustment.entity_id == supplier_id)

            res = await db.execute(query)
            adjustment = res.scalars().first()

            if not adjustment:
                raise NotFoundException(
                    f"Supplier balance adjustment record with ID '{adjustment_id}' not found."
                )

            target_supplier_id = adjustment.entity_id

            # Audit Log for deletion of the history record
            log_payload = json.dumps({
                "adjustment_id": adjustment.id,
                "supplier_id": target_supplier_id,
                "previous_balance": adjustment.previous_balance,
                "new_balance": adjustment.new_balance,
                "difference": adjustment.difference,
                "reason": adjustment.reason,
                "action": "history_record_deleted",
            })
            activity = ActivityLog(
                user_id=user.id,
                action="supplier.balance.adjustment.delete",
                entity_type="supplier",
                entity_id=target_supplier_id,
                payload=log_payload,
            )
            db.add(activity)

            # Delete ONLY the adjustment history record
            await db.delete(adjustment)

            # Supplier current_balance is intentionally and strictly left unchanged
            await db.commit()

            return {
                "id": adjustment_id,
                "supplier_id": target_supplier_id,
                "deleted": True,
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete supplier balance adjustment history: {str(e)}")
            raise e


balance_adjustment_service = BalanceAdjustmentService()

