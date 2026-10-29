import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import get_preset_date_ranges, normalize_date_range
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
        Updates customer's current due balance (by both collection amount and discount amount)
        and writes an ActivityLog entry.
        Rolls back all changes if any error occurs.
        """
        try:
            # 1. Validate Customer
            customer = await customer_repository.get_by_id(db, id=collection_in.customer_id)
            if not customer:
                raise NotFoundException(f"Customer with ID '{collection_in.customer_id}' not found.")
            if customer.status != "active":
                raise BadRequestException(f"Customer '{customer.name}' is inactive.")

            # 2. Validate Amounts
            amount = round(float(collection_in.amount or 0.0), 2)
            discount_amount = round(float(getattr(collection_in, "discount_amount", 0.0) or 0.0), 2)

            if amount < 0:
                raise BadRequestException("Collection amount cannot be negative.")
            if discount_amount < 0:
                raise BadRequestException("Discount amount cannot be negative.")

            total_reduction = round(amount + discount_amount, 2)
            if total_reduction <= 0:
                raise BadRequestException("Collection amount or discount amount must be greater than zero.")

            # 3. Prevent combined collection and discount from exceeding customer's outstanding balance
            current_due = round(float(customer.current_balance or 0.0), 2)
            if current_due > 0 or discount_amount > 0:
                available_due = max(0.0, current_due)
                if total_reduction > round(available_due + 1e-6, 2):
                    raise BadRequestException(
                        f"Combined collection ({amount:.2f}) and discount ({discount_amount:.2f}) "
                        f"cannot exceed customer's outstanding balance ({available_due:.2f})."
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
                amount=amount,
                discount_amount=discount_amount,
                payment_method=collection_in.payment_method,
                reference_no=collection_in.reference_no,
                collection_date=col_date,
                notes=collection_in.notes.strip() if (collection_in.notes and collection_in.notes.strip()) else None,
            )
            db.add(collection)
            await db.flush()

            # 6. Update Customer Current Due Balance by both actual collection and waived discount
            customer.current_balance = round(float(customer.current_balance or 0.0) - total_reduction, 2)
            
            db.add(customer)

            # 7. Create Activity Audit Log
            log_payload = json.dumps({
                "collection_no": collection_no,
                "customer_id": customer.id,
                "customer_name": customer.name,
                "amount": amount,
                "discount_amount": discount_amount,
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

            old_amount = round(float(collection.amount or 0.0), 2)
            old_discount = round(float(getattr(collection, "discount_amount", 0.0) or 0.0), 2)
            old_total = round(old_amount + old_discount, 2)

            new_amount = round(float(collection_in.amount if collection_in.amount is not None else old_amount), 2)
            new_discount = round(
                float(collection_in.discount_amount if collection_in.discount_amount is not None else old_discount), 2
            )

            if new_amount < 0:
                raise BadRequestException("Collection amount cannot be negative.")
            if new_discount < 0:
                raise BadRequestException("Discount amount cannot be negative.")

            new_total = round(new_amount + new_discount, 2)
            if new_total <= 0:
                raise BadRequestException("Collection amount or discount amount must be greater than zero.")

            # Customer's balance before this collection was applied
            balance_before = round(float(customer.current_balance or 0.0) + old_total, 2)
            if balance_before > 0 or new_discount > 0:
                available_due = max(0.0, balance_before)
                if new_total > round(available_due + 1e-6, 2):
                    raise BadRequestException(
                        f"Combined collection ({new_amount:.2f}) and discount ({new_discount:.2f}) "
                        f"cannot exceed customer's outstanding balance ({available_due:.2f})."
                    )

            # Net balance adjustment (Reverse old total, Apply new total)
            customer.current_balance = round(balance_before - new_total, 2)
            
            db.add(customer)

            # Update collection attributes
            if collection_in.amount is not None:
                collection.amount = new_amount
            if collection_in.discount_amount is not None:
                collection.discount_amount = new_discount
            if collection_in.payment_method is not None:
                collection.payment_method = collection_in.payment_method
            if collection_in.reference_no is not None:
                collection.reference_no = collection_in.reference_no
            if collection_in.collection_date is not None:
                collection.collection_date = collection_in.collection_date
            if any(f in collection_in.model_fields_set for f in ("notes", "note")):
                val = collection_in.notes if collection_in.notes is not None else collection_in.note
                collection.notes = val.strip() if (val and val.strip()) else None
            if collection_in.sale_id is not None:
                collection.sale_id = collection_in.sale_id

            db.add(collection)

            # Audit Log
            log_payload = json.dumps({
                "collection_no": collection.collection_no,
                "customer_id": customer.id,
                "old_amount": old_amount,
                "new_amount": new_amount,
                "old_discount_amount": old_discount,
                "new_discount_amount": new_discount,
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

            restored_total = round(
                float(collection.amount or 0.0) + float(getattr(collection, "discount_amount", 0.0) or 0.0), 2
            )
            customer = await customer_repository.get_by_id(db, id=collection.customer_id)
            if customer:
                # Restore customer due/advance (Revert both collection amount and waived discount)
                customer.current_balance = round(float(customer.current_balance or 0.0) + restored_total, 2)
                db.add(customer)

            # Audit Log
            log_payload = json.dumps({
                "collection_no": collection.collection_no,
                "customer_id": collection.customer_id,
                "restored_amount": collection.amount,
                "restored_discount_amount": getattr(collection, "discount_amount", 0.0),
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

            await db.delete(collection)

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
        if start_date is not None or end_date is not None:
            start_date, end_date = normalize_date_range(start_date, end_date, default_to_today=False)
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
        # Handle preset filter calculations strictly in business timezone
        if preset_range in ("today", "yesterday", "this_week", "this_month", "this_year"):
            presets = get_preset_date_ranges()
            start_date, end_date = presets[preset_range]
        elif start_date is not None or end_date is not None:
            start_date, end_date = normalize_date_range(start_date, end_date, default_to_today=False)

        return await customer_collection_repository.get_report_data(
            db,
            start_date=start_date,
            end_date=end_date,
            search=search,
            customer_id=customer_id,
            payment_method=payment_method,
        )


customer_collection_service = CustomerCollectionService()
