import json
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.activity_log import ActivityLog
from app.models.customer_collection import CustomerCollection
from app.repositories.customer_collection_repository import customer_collection_repository
from app.repositories.customer_repository import customer_repository
from app.schemas.customer_collection import (
    CustomerCollectionCreate,
    CustomerCollectionUpdate,
)


class CustomerCollectionService:
    async def create_collection(
        self, db: AsyncSession, user_id: str, collection_in: CustomerCollectionCreate
    ) -> CustomerCollection:
        """
        Creates a new Customer Collection voucher inside a single database transaction.
        Updates customer's current due balance and writes an ActivityLog entry.
        Rolls back all changes if any error occurs.
        """
        try:
            # 1. Validate Customer
            customer = await customer_repository.get_by_id(db, id=collection_in.customer_id)
            if not customer:
                raise NotFoundException(f"Customer with ID '{collection_in.customer_id}' not found.")
            if customer.status != "active":
                raise BadRequestException(f"Customer '{customer.name}' is inactive.")

            # 2. Validate Amount > 0
            if collection_in.amount <= 0:
                raise BadRequestException("Collection amount must be greater than zero.")

            # 3. Business Rule: Collection amount cannot exceed customer's current due
            # Note: If current_balance is <= 0, customer has no outstanding due.
            if customer.current_balance <= 0:
                raise BadRequestException(
                    f"Customer '{customer.name}' has no outstanding due balance (Current Due: ${customer.current_balance:.2f})."
                )

            if collection_in.amount > customer.current_balance:
                raise BadRequestException(
                    f"Collection amount (${collection_in.amount:.2f}) cannot exceed customer's current due (${customer.current_balance:.2f})."
                )

            # 4. Generate Collection Number
            collection_no = await customer_collection_repository.generate_collection_no(db)

            col_date = collection_in.collection_date or datetime.now(timezone.utc)

            # 5. Create Collection Record
            collection = CustomerCollection(
                collection_no=collection_no,
                customer_id=customer.id,
                sale_id=collection_in.sale_id,
                user_id=user_id,
                amount=collection_in.amount,
                payment_method=collection_in.payment_method,
                reference_no=collection_in.reference_no,
                collection_date=col_date,
                notes=collection_in.notes,
            )
            db.add(collection)
            await db.flush()

            # 6. Update Customer Current Due Balance
            customer.current_balance -= collection_in.amount
            db.add(customer)

            # 7. Create Activity Audit Log
            log_payload = json.dumps({
                "collection_no": collection_no,
                "customer_id": customer.id,
                "customer_name": customer.name,
                "amount": collection_in.amount,
                "payment_method": collection_in.payment_method,
                "new_due_balance": customer.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="collection.create",
                entity_type="customer_collection",
                entity_id=collection.id,
                payload=log_payload,
            )
            db.add(log_entry)

            # 8. Single Transaction Commit
            await db.commit()

            # Fetch fresh model with relationships loaded
            return await self.get_collection(db, collection.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create customer collection: {str(e)}")
            raise e

    async def update_collection(
        self, db: AsyncSession, user_id: str, collection_id: str, collection_in: CustomerCollectionUpdate
    ) -> CustomerCollection:
        """
        Updates an existing Collection record inside a single database transaction.
        Recalculates customer current due automatically and logs activity.
        """
        try:
            collection = await customer_collection_repository.get_by_id(db, id=collection_id)
            if not collection:
                raise NotFoundException(f"Collection voucher with ID '{collection_id}' not found.")

            customer = await customer_repository.get_by_id(db, id=collection.customer_id)
            if not customer:
                raise NotFoundException(f"Associated customer with ID '{collection.customer_id}' not found.")

            old_amount = collection.amount
            new_amount = collection_in.amount if collection_in.amount is not None else old_amount

            if new_amount <= 0:
                raise BadRequestException("Collection amount must be greater than zero.")

            # Calculate available due for this customer before this collection was applied
            available_due = customer.current_balance + old_amount

            if new_amount > available_due:
                raise BadRequestException(
                    f"Updated collection amount (${new_amount:.2f}) cannot exceed customer's available due (${available_due:.2f})."
                )

            # Net balance adjustment
            net_difference = old_amount - new_amount
            customer.current_balance += net_difference
            db.add(customer)

            # Update collection attributes
            if collection_in.amount is not None:
                collection.amount = collection_in.amount
            if collection_in.payment_method is not None:
                collection.payment_method = collection_in.payment_method
            if collection_in.reference_no is not None:
                collection.reference_no = collection_in.reference_no
            if collection_in.collection_date is not None:
                collection.collection_date = collection_in.collection_date
            if collection_in.notes is not None:
                collection.notes = collection_in.notes
            if collection_in.sale_id is not None:
                collection.sale_id = collection_in.sale_id

            db.add(collection)

            # Audit Log
            log_payload = json.dumps({
                "collection_no": collection.collection_no,
                "customer_id": customer.id,
                "old_amount": old_amount,
                "new_amount": new_amount,
                "recalculated_due": customer.current_balance,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="collection.edit",
                entity_type="customer_collection",
                entity_id=collection.id,
                payload=log_payload,
            )
            db.add(log_entry)

            await db.commit()

            return await self.get_collection(db, collection.id)

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update customer collection '{collection_id}': {str(e)}")
            raise e

    async def delete_collection(self, db: AsyncSession, user_id: str, collection_id: str) -> bool:
        """
        Deletes a Collection voucher inside a single database transaction.
        Restores customer due balance automatically.
        """
        try:
            collection = await customer_collection_repository.get_by_id(db, id=collection_id)
            if not collection:
                raise NotFoundException(f"Collection voucher with ID '{collection_id}' not found.")

            customer = await customer_repository.get_by_id(db, id=collection.customer_id)
            if customer:
                # Restore customer due
                customer.current_balance += collection.amount
                db.add(customer)

            # Audit Log
            log_payload = json.dumps({
                "collection_no": collection.collection_no,
                "customer_id": collection.customer_id,
                "restored_amount": collection.amount,
                "updated_due": customer.current_balance if customer else None,
            })
            log_entry = ActivityLog(
                user_id=user_id,
                action="collection.delete",
                entity_type="customer_collection",
                entity_id=collection_id,
                payload=log_payload,
            )
            db.add(log_entry)

            await customer_collection_repository.delete(db, id=collection_id)

            await db.commit()
            return True

        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete customer collection '{collection_id}': {str(e)}")
            raise e

    async def get_collection(self, db: AsyncSession, collection_id: str) -> CustomerCollection:
        collection = await customer_collection_repository.get_by_id(db, id=collection_id)
        if not collection:
            raise NotFoundException(f"Collection voucher with ID '{collection_id}' not found.")
        return collection

    async def get_collections_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: Optional[str] = "newest",
    ) -> tuple[Sequence[CustomerCollection], int]:
        return await customer_collection_repository.get_filtered(
            db,
            skip=skip,
            limit=limit,
            search=search,
            customer_id=customer_id,
            payment_method=payment_method,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
        )

    async def get_customer_summary(self, db: AsyncSession, customer_id: str) -> dict:
        summary = await customer_collection_repository.get_customer_financial_summary(db, customer_id)
        if not summary:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")
        return summary

    async def get_collection_reports(
        self,
        db: AsyncSession,
        *,
        preset_range: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> dict:
        now_utc = datetime.now(timezone.utc)

        # Handle preset filter calculations if provided
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

        return await customer_collection_repository.get_report_data(
            db,
            start_date=start_date,
            end_date=end_date,
            search=search,
            customer_id=customer_id,
            payment_method=payment_method,
        )


customer_collection_service = CustomerCollectionService()
