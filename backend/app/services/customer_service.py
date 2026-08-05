from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem
from app.models.customer_collection import CustomerCollection
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.models.balance_adjustment import BalanceAdjustment
from app.repositories.customer_repository import customer_repository
from app.schemas.customer import CustomerCreate, CustomerUpdate


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CustomerService:
    async def create_customer(self, db: AsyncSession, customer_in: CustomerCreate) -> Customer:
        """
        Creates a new customer profile.
        Opening due automatically initializes the customer's current due balance.
        """
        # Customer code handling
        if customer_in.customer_code and customer_in.customer_code.strip():
            existing_code = await customer_repository.get_by_code(db, customer_in.customer_code.strip())
            if existing_code:
                raise ConflictException(f"Customer code '{customer_in.customer_code}' already exists.")
            code = customer_in.customer_code.strip()
        else:
            code = await customer_repository.generate_customer_code(db)

        customer_data = customer_in.model_dump()
        customer_data["customer_code"] = code
        # Opening Due automatically initializes Current Due
        customer_data["current_balance"] = customer_in.opening_balance or 0.0

        return await customer_repository.create(db, obj_in=customer_data)

    async def update_customer(
        self, db: AsyncSession, customer_id: str, customer_in: CustomerUpdate
    ) -> Customer:
        customer = await customer_repository.get_by_id(db, id=customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")

        update_data = customer_in.model_dump(exclude_unset=True)
        return await customer_repository.update(db, db_obj=customer, obj_in=update_data)

    async def delete_customer(self, db: AsyncSession, customer_id: str) -> bool:
        customer = await customer_repository.get_by_id(db, id=customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")

        # Check for existing sales transactions
        sales_query = select(func.count(Sale.id)).where(Sale.customer_id == customer_id)
        sales_count_res = await db.execute(sales_query)
        sales_count = sales_count_res.scalar() or 0

        if sales_count > 0:
            raise BadRequestException(
                f"Cannot delete customer '{customer.name}': customer has {sales_count} existing transaction(s). Set status to 'inactive' instead."
            )

        await customer_repository.delete(db, id=customer_id)
        return True

    async def hard_delete_customer(self, db: AsyncSession, customer_id: str) -> bool:
        """
        Permanently hard deletes a customer and all dependent records in correct cascade order:
        1. SaleReturnItems & SaleReturns
        2. SaleItems & Sales
        3. CustomerCollections
        4. BalanceAdjustments
        5. Customer record
        """
        customer = await customer_repository.get_by_id(db, id=customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")

        # 1. Delete SaleReturnItems and SaleReturns
        returns_q = select(SaleReturn.id).where(SaleReturn.customer_id == customer_id)
        returns_res = await db.execute(returns_q)
        return_ids = returns_res.scalars().all()
        if return_ids:
            await db.execute(delete(SaleReturnItem).where(SaleReturnItem.sale_return_id.in_(return_ids)))
            await db.execute(delete(SaleReturn).where(SaleReturn.id.in_(return_ids)))

        # 2. Delete SaleItems and Sales
        sales_q = select(Sale.id).where(Sale.customer_id == customer_id)
        sales_res = await db.execute(sales_q)
        sale_ids = sales_res.scalars().all()
        if sale_ids:
            await db.execute(delete(SaleItem).where(SaleItem.sale_id.in_(sale_ids)))
            await db.execute(delete(Sale).where(Sale.id.in_(sale_ids)))

        # 3. Delete CustomerCollections
        await db.execute(delete(CustomerCollection).where(CustomerCollection.customer_id == customer_id))

        # 4. Delete BalanceAdjustments
        await db.execute(delete(BalanceAdjustment).where(BalanceAdjustment.customer_id == customer_id))

        # 5. Delete Customer
        await customer_repository.delete(db, id=customer_id)
        await db.commit()
        return True

    async def get_customer(self, db: AsyncSession, customer_id: str) -> Customer:
        customer = await customer_repository.get_by_id(db, id=customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")
        return customer

    async def get_customers_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        due_only: bool = False,
    ) -> tuple[Sequence[Customer], int]:
        return await customer_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, status=status, due_only=due_only
        )

    async def get_customer_ledger(
        self,
        db: AsyncSession,
        customer_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        customer = await customer_repository.get_by_id(db, id=customer_id)
        if not customer:
            raise NotFoundException(f"Customer with ID '{customer_id}' not found.")

        # 1. Fetch Sales
        sales_res = await db.execute(
            select(Sale).where(Sale.customer_id == customer_id).order_by(Sale.sale_date.asc())
        )
        sales = sales_res.scalars().all()

        # 2. Fetch Collections
        cols_res = await db.execute(
            select(CustomerCollection).where(CustomerCollection.customer_id == customer_id).order_by(CustomerCollection.collection_date.asc())
        )
        collections = cols_res.scalars().all()

        # 3. Fetch Returns
        rets_res = await db.execute(
            select(SaleReturn).where(SaleReturn.customer_id == customer_id).order_by(SaleReturn.return_date.asc())
        )
        returns = rets_res.scalars().all()

        # 4. Fetch Balance Adjustments
        adjustments = []
        try:
            adjs_res = await db.execute(
                select(BalanceAdjustment).where(
                    BalanceAdjustment.entity_type == "customer",
                    BalanceAdjustment.entity_id == customer_id
                ).order_by(BalanceAdjustment.effective_date.asc())
            )
            adjustments = adjs_res.scalars().all()
        except Exception:
            adjustments = []

        # Existing collection sale_ids to prevent double counting
        existing_col_sale_ids = {col.sale_id for col in collections if col.sale_id}

        # Master chronological list of raw events
        raw_events = []

        # Opening Balance event
        if customer.opening_balance != 0 or customer.created_at:
            op_debit = customer.opening_balance if customer.opening_balance > 0 else 0.0
            op_credit = abs(customer.opening_balance) if customer.opening_balance < 0 else 0.0
            raw_events.append({
                "id": f"op-{customer.id}",
                "date": customer.created_at,
                "voucher_no": customer.customer_code,
                "type": "Opening Balance",
                "description": "Initial Customer Opening Balance",
                "debit": op_debit,
                "credit": op_credit,
                "reference_id": customer.id,
                "reference_type": None,
            })

        # Sales events
        for sale in sales:
            raw_events.append({
                "id": f"sale-{sale.id}",
                "date": sale.sale_date,
                "voucher_no": sale.invoice_no,
                "type": "Sale",
                "description": f"Sales Invoice ({len(sale.items)} items)",
                "debit": sale.grand_total,
                "credit": 0.0,
                "reference_id": sale.id,
                "reference_type": "sale",
            })
            if sale.paid_amount > 0 and sale.id not in existing_col_sale_ids:
                raw_events.append({
                    "id": f"sale-pay-{sale.id}",
                    "date": sale.sale_date,
                    "voucher_no": sale.invoice_no,
                    "type": "Collection",
                    "description": f"Immediate payment for invoice {sale.invoice_no}",
                    "debit": 0.0,
                    "credit": sale.paid_amount,
                    "reference_id": sale.id,
                    "reference_type": "sale",
                })

        # Collection events
        for col in collections:
            pm = col.payment_method.replace("_", " ").title()
            raw_events.append({
                "id": f"col-{col.id}",
                "date": col.collection_date,
                "voucher_no": col.collection_no,
                "type": "Collection",
                "description": f"Payment Collection ({pm}){f' - {col.notes}' if col.notes else ''}",
                "debit": 0.0,
                "credit": col.amount,
                "reference_id": col.id,
                "reference_type": "collection",
            })

        # Return events
        for ret in returns:
            raw_events.append({
                "id": f"ret-{ret.id}",
                "date": ret.return_date,
                "voucher_no": ret.return_no,
                "type": "Sale Return",
                "description": f"Sale Return for invoice {ret.sale.invoice_no if ret.sale else ''}",
                "debit": 0.0,
                "credit": ret.grand_total,
                "reference_id": ret.id,
                "reference_type": "sale_return",
            })

        # Adjustment events
        for adj in adjustments:
            adj_debit = adj.difference if adj.difference > 0 else 0.0
            adj_credit = abs(adj.difference) if adj.difference < 0 else 0.0
            raw_events.append({
                "id": f"adj-{adj.id}",
                "date": adj.effective_date,
                "voucher_no": f"ADJ-{adj.id[:8].upper()}",
                "type": "Balance Adjustment",
                "description": f"{adj.reason}{f' - {adj.notes}' if adj.notes else ''}",
                "debit": adj_debit,
                "credit": adj_credit,
                "reference_id": adj.id,
                "reference_type": "balance_adjustment",
            })

        # Sort all events chronologically with safe UTC conversion
        raw_events.sort(key=lambda x: _to_utc(x["date"]))

        # Compute running balance for all events
        running_bal = 0.0
        calculated_events = []

        total_sales = 0.0
        total_collections = 0.0
        total_returns = 0.0
        manual_adjustments = 0.0

        start_utc = _to_utc(start_date)
        end_utc = _to_utc(end_date)

        for ev in raw_events:
            running_bal = running_bal + ev["debit"] - ev["credit"]
            ev["running_balance"] = round(running_bal, 2)

            if ev["type"] == "Sale":
                total_sales += ev["debit"]
            elif ev["type"] == "Collection":
                total_collections += ev["credit"]
            elif ev["type"] == "Sale Return":
                total_returns += ev["credit"]
            elif ev["type"] == "Balance Adjustment":
                manual_adjustments += (ev["debit"] - ev["credit"])

            ev_date_utc = _to_utc(ev["date"])
            # Filter by date range if specified
            if start_utc and ev_date_utc < start_utc:
                continue
            if end_utc and ev_date_utc > end_utc:
                continue

            calculated_events.append(ev)

        summary = {
            "opening_balance": customer.opening_balance,
            "total_sales": round(total_sales, 2),
            "total_collections": round(total_collections, 2),
            "total_returns": round(total_returns, 2),
            "manual_adjustments": round(manual_adjustments, 2),
            "current_due": round(customer.current_balance, 2),
        }

        return {
            "customer": customer,
            "summary": summary,
            "transactions": calculated_events,
        }


customer_service = CustomerService()

