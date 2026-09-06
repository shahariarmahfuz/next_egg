from datetime import date
from typing import Sequence, Optional, Tuple, List
from sqlalchemy import select, func, and_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.farm_transaction import FarmTransaction, FarmTransactionType
from app.models.product import Product


class FarmRepository:
    async def create_transaction(self, db: AsyncSession, obj_in: FarmTransaction) -> FarmTransaction:
        db.add(obj_in)
        await db.commit()
        await db.refresh(obj_in)
        # Load product relationship
        query = select(FarmTransaction).options(selectinload(FarmTransaction.product)).where(FarmTransaction.id == obj_in.id)
        result = await db.execute(query)
        return result.scalars().first() or obj_in

    async def get_transactions(
        self,
        db: AsyncSession,
        *,
        transaction_type: Optional[FarmTransactionType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        product_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[Sequence[FarmTransaction], int]:
        query = select(FarmTransaction).options(selectinload(FarmTransaction.product))

        filters = []
        if transaction_type:
            filters.append(FarmTransaction.transaction_type == transaction_type)
        if start_date:
            filters.append(FarmTransaction.transaction_date >= start_date)
        if end_date:
            filters.append(FarmTransaction.transaction_date <= end_date)
        if product_id:
            filters.append(FarmTransaction.product_id == product_id)

        if filters:
            query = query.where(and_(*filters))

        # Total count
        count_query = select(func.count()).select_from(query.subquery())
        count_res = await db.execute(count_query)
        total = count_res.scalar() or 0

        # Order & Paginate
        query = query.order_by(desc(FarmTransaction.transaction_date), desc(FarmTransaction.created_at)).offset(skip).limit(limit)
        res = await db.execute(query)
        items = res.scalars().all()

        return items, total

    async def get_dashboard_kpis(self, db: AsyncSession, today: date) -> dict:
        # Today's Production
        prod_query = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
            and_(
                FarmTransaction.transaction_type == FarmTransactionType.PRODUCTION,
                FarmTransaction.transaction_date == today,
            )
        )
        prod_res = await db.execute(prod_query)
        today_prod = float(prod_res.scalar() or 0.0)

        # Today's Trays
        trays_query = select(func.coalesce(func.sum(FarmTransaction.tray_count), 0.0)).where(
            and_(
                FarmTransaction.transaction_type == FarmTransactionType.PRODUCTION,
                FarmTransaction.transaction_date == today,
            )
        )
        trays_res = await db.execute(trays_query)
        today_trays = float(trays_res.scalar() or 0.0)

        # Today's Delivered
        del_query = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
            and_(
                FarmTransaction.transaction_type == FarmTransactionType.DELIVERY,
                FarmTransaction.transaction_date == today,
            )
        )
        del_res = await db.execute(del_query)
        today_del = float(del_res.scalar() or 0.0)

        # Today's Waste
        waste_query = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
            and_(
                FarmTransaction.transaction_type == FarmTransactionType.WASTE,
                FarmTransaction.transaction_date == today,
            )
        )
        waste_res = await db.execute(waste_query)
        today_waste = float(waste_res.scalar() or 0.0)

        # Current Farm Stock (sum of all farm products' current_stock)
        stock_query = select(func.coalesce(func.sum(Product.current_stock), 0.0)).where(Product.product_type == "FARM")
        stock_res = await db.execute(stock_query)
        current_stock = float(stock_res.scalar() or 0.0)

        return {
            "today_production": today_prod,
            "today_trays": today_trays,
            "today_delivered": today_del,
            "today_waste": today_waste,
            "current_farm_stock": current_stock,
        }

    async def get_farm_stock_overview(self, db: AsyncSession) -> List[dict]:
        products_query = select(Product).where(Product.product_type == "FARM").order_by(Product.name)
        p_res = await db.execute(products_query)
        farm_products = p_res.scalars().all()

        stock_items = []
        for p in farm_products:
            # Aggregate production, delivery, waste
            prod_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p.id,
                FarmTransaction.transaction_type == FarmTransactionType.PRODUCTION,
            )
            del_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p.id,
                FarmTransaction.transaction_type == FarmTransactionType.DELIVERY,
            )
            waste_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p.id,
                FarmTransaction.transaction_type == FarmTransactionType.WASTE,
            )

            prod_val = float((await db.execute(prod_q)).scalar() or 0.0)
            del_val = float((await db.execute(del_q)).scalar() or 0.0)
            waste_val = float((await db.execute(waste_q)).scalar() or 0.0)

            stock_items.append({
                "product_id": p.id,
                "product_code": p.product_code,
                "name": p.name,
                "unit": p.unit,
                "opening_stock": float(p.opening_stock),
                "total_production": prod_val,
                "total_delivery": del_val,
                "total_waste": waste_val,
                "current_stock": float(p.current_stock),
            })

        return stock_items

    async def get_farm_report(self, db: AsyncSession, start_date: date, end_date: date) -> dict:
        # Group transactions by date and product
        query = select(
            FarmTransaction.transaction_date,
            FarmTransaction.product_id,
            Product.name.label("product_name"),
            Product.opening_stock,
            func.coalesce(
                func.sum(
                    case(
                        (FarmTransaction.transaction_type == FarmTransactionType.PRODUCTION, FarmTransaction.quantity),
                        else_=0,
                    )
                ),
                0.0,
            ).label("production"),
            func.coalesce(
                func.sum(
                    case(
                        (FarmTransaction.transaction_type == FarmTransactionType.DELIVERY, FarmTransaction.quantity),
                        else_=0,
                    )
                ),
                0.0,
            ).label("delivery"),
            func.coalesce(
                func.sum(
                    case(
                        (FarmTransaction.transaction_type == FarmTransactionType.WASTE, FarmTransaction.quantity),
                        else_=0,
                    )
                ),
                0.0,
            ).label("waste"),
        ).join(Product, Product.id == FarmTransaction.product_id)\
         .where(
             and_(
                 FarmTransaction.transaction_date >= start_date,
                 FarmTransaction.transaction_date <= end_date,
             )
         )\
         .group_by(FarmTransaction.transaction_date, FarmTransaction.product_id, Product.name, Product.opening_stock)\
         .order_by(FarmTransaction.transaction_date.desc(), Product.name)

        result = await db.execute(query)
        raw_rows = result.all()

        report_rows = []
        tot_prod = 0.0
        tot_del = 0.0
        tot_waste = 0.0

        for row in raw_rows:
            p_id = row.product_id
            t_date = row.transaction_date
            prod = float(row.production)
            deliver = float(row.delivery)
            waste = float(row.waste)
            opening = float(row.opening_stock)

            tot_prod += prod
            tot_del += deliver
            tot_waste += waste

            # Calculate cumulative stock up to and including this transaction date:
            # Opening + all production up to date - all delivery up to date - all waste up to date
            cum_prod_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p_id,
                FarmTransaction.transaction_type == FarmTransactionType.PRODUCTION,
                FarmTransaction.transaction_date <= t_date,
            )
            cum_del_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p_id,
                FarmTransaction.transaction_type == FarmTransactionType.DELIVERY,
                FarmTransaction.transaction_date <= t_date,
            )
            cum_waste_q = select(func.coalesce(func.sum(FarmTransaction.quantity), 0.0)).where(
                FarmTransaction.product_id == p_id,
                FarmTransaction.transaction_type == FarmTransactionType.WASTE,
                FarmTransaction.transaction_date <= t_date,
            )

            cum_prod = float((await db.execute(cum_prod_q)).scalar() or 0.0)
            cum_del = float((await db.execute(cum_del_q)).scalar() or 0.0)
            cum_waste = float((await db.execute(cum_waste_q)).scalar() or 0.0)

            remaining = opening + cum_prod - cum_del - cum_waste

            report_rows.append({
                "date": t_date,
                "product_id": p_id,
                "product_name": row.product_name,
                "production": prod,
                "delivery": deliver,
                "waste": waste,
                "remaining_quantity": remaining,
            })

        # Calculate total remaining across all farm products currently
        current_stock_q = select(func.coalesce(func.sum(Product.current_stock), 0.0)).where(Product.product_type == "FARM")
        tot_remaining = float((await db.execute(current_stock_q)).scalar() or 0.0)

        return {
            "items": report_rows,
            "total_production": tot_prod,
            "total_delivery": tot_del,
            "total_waste": tot_waste,
            "total_remaining": tot_remaining,
        }


farm_repository = FarmRepository()

