from datetime import date
from typing import Sequence, Optional, Tuple, List, Dict, Any
from sqlalchemy import select, func, and_, desc, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.farm import Farm
from app.models.farm_entry import FarmEntry
from app.models.farm_production import FarmProduction
from app.models.farm_delivery import FarmDelivery


class FarmRepository:
    # --- Farm Operations ---
    async def create_farm(self, db: AsyncSession, obj_in: Farm) -> Farm:
        db.add(obj_in)
        await db.commit()
        await db.refresh(obj_in)
        return obj_in

    async def get_farm_by_id(self, db: AsyncSession, farm_id: str) -> Optional[Farm]:
        query = select(Farm).where(Farm.id == farm_id)
        res = await db.execute(query)
        return res.scalars().first()

    async def get_farm_by_code(self, db: AsyncSession, code: str) -> Optional[Farm]:
        query = select(Farm).where(Farm.code == code)
        res = await db.execute(query)
        return res.scalars().first()

    async def get_all_farms(self, db: AsyncSession, status: Optional[str] = None) -> Sequence[Farm]:
        query = select(Farm)
        if status:
            query = query.where(Farm.status == status)
        query = query.order_by(Farm.name)
        res = await db.execute(query)
        return res.scalars().all()

    async def update_farm(self, db: AsyncSession, farm: Farm) -> Farm:
        db.add(farm)
        await db.commit()
        await db.refresh(farm)
        return farm

    async def get_farm_balance(self, db: AsyncSession, farm_id: str) -> Dict[str, float]:
        farm = await self.get_farm_by_id(db, farm_id)
        if not farm:
            return {"previous_tray": 0.0, "production": 0.0, "delivered": 0.0, "available": 0.0}

        entry_prod_query = select(func.coalesce(func.sum(FarmEntry.production_trays), 0.0)).where(
            FarmEntry.farm_id == farm_id
        )
        entry_prod_res = await db.execute(entry_prod_query)
        entry_prod = float(entry_prod_res.scalar() or 0.0)

        legacy_prod_query = select(func.coalesce(func.sum(FarmProduction.tray_quantity), 0.0)).where(
            FarmProduction.farm_id == farm_id
        )
        legacy_prod_res = await db.execute(legacy_prod_query)
        legacy_prod = float(legacy_prod_res.scalar() or 0.0)

        total_prod = entry_prod + legacy_prod

        deliv_query = select(func.coalesce(func.sum(FarmDelivery.tray_quantity), 0.0)).where(
            FarmDelivery.farm_id == farm_id
        )
        deliv_res = await db.execute(deliv_query)
        total_deliv = float(deliv_res.scalar() or 0.0)

        prev = float(farm.previous_tray or 0.0)
        available = prev + total_prod - total_deliv

        return {
            "previous_tray": prev,
            "production": total_prod,
            "delivered": total_deliv,
            "available": available,
        }

    async def get_all_farms_with_balances(
        self, db: AsyncSession, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        farms = await self.get_all_farms(db, status=status)
        results = []
        for farm in farms:
            bal = await self.get_farm_balance(db, farm.id)
            results.append({
                "id": farm.id,
                "name": farm.name,
                "code": farm.code,
                "address": farm.address,
                "contact_number": farm.contact_number,
                "email": farm.email,
                "status": farm.status,
                "notes": farm.notes,
                "previous_tray": bal["previous_tray"],
                "total_production": bal["production"],
                "total_delivered": bal["delivered"],
                "available_tray": bal["available"],
                "created_at": farm.created_at,
                "updated_at": farm.updated_at,
            })
        return results

    # --- Farm Daily Entry Operations ---
    async def create_entry(
        self, db: AsyncSession, entry: FarmEntry, deliveries: List[FarmDelivery]
    ) -> FarmEntry:
        db.add(entry)
        await db.flush()
        for d in deliveries:
            d.entry_id = entry.id
            d.farm_id = entry.farm_id
            d.delivery_date = entry.date
            db.add(d)
        await db.commit()
        await db.refresh(entry)
        saved = await self.get_entry_by_id(db, entry.id)
        return saved or entry

    async def get_entry_by_id(self, db: AsyncSession, entry_id: str) -> Optional[FarmEntry]:
        query = (
            select(FarmEntry)
            .options(selectinload(FarmEntry.deliveries), selectinload(FarmEntry.farm))
            .where(FarmEntry.id == entry_id)
        )
        res = await db.execute(query)
        return res.scalars().first()

    async def get_entries(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[Sequence[FarmEntry], int]:
        filters = []
        if farm_id:
            filters.append(FarmEntry.farm_id == farm_id)
        if start_date:
            filters.append(FarmEntry.date >= start_date)
        if end_date:
            filters.append(FarmEntry.date <= end_date)

        count_query = select(func.count(FarmEntry.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total = (await db.execute(count_query)).scalar() or 0

        query = (
            select(FarmEntry)
            .options(selectinload(FarmEntry.deliveries), selectinload(FarmEntry.farm))
            .order_by(desc(FarmEntry.date), desc(FarmEntry.created_at))
            .offset(skip)
            .limit(limit)
        )
        if filters:
            query = query.where(and_(*filters))

        res = await db.execute(query)
        items = res.scalars().all()
        return items, total

    async def update_entry(
        self,
        db: AsyncSession,
        entry: FarmEntry,
        new_deliveries: Optional[List[FarmDelivery]] = None,
    ) -> FarmEntry:
        db.add(entry)
        if new_deliveries is not None:
            del_stmt = delete(FarmDelivery).where(FarmDelivery.entry_id == entry.id)
            await db.execute(del_stmt)
            for d in new_deliveries:
                d.entry_id = entry.id
                d.farm_id = entry.farm_id
                d.delivery_date = entry.date
                db.add(d)
        else:
            sync_stmt = (
                update(FarmDelivery)
                .where(FarmDelivery.entry_id == entry.id)
                .values(delivery_date=entry.date, farm_id=entry.farm_id)
            )
            await db.execute(sync_stmt)

        await db.commit()
        await db.refresh(entry)
        saved = await self.get_entry_by_id(db, entry.id)
        return saved or entry

    async def delete_entry(self, db: AsyncSession, entry: FarmEntry) -> None:
        await db.delete(entry)
        await db.commit()

    # --- Legacy Production Operations ---
    async def create_production(self, db: AsyncSession, obj_in: FarmProduction) -> FarmProduction:
        db.add(obj_in)
        await db.commit()
        await db.refresh(obj_in)
        query = (
            select(FarmProduction)
            .options(selectinload(FarmProduction.farm))
            .where(FarmProduction.id == obj_in.id)
        )
        res = await db.execute(query)
        return res.scalars().first() or obj_in

    async def get_production_by_id(self, db: AsyncSession, prod_id: str) -> Optional[FarmProduction]:
        query = (
            select(FarmProduction)
            .options(selectinload(FarmProduction.farm))
            .where(FarmProduction.id == prod_id)
        )
        res = await db.execute(query)
        return res.scalars().first()

    async def get_productions(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[Sequence[FarmProduction], int]:
        filters = []
        if farm_id:
            filters.append(FarmProduction.farm_id == farm_id)
        if start_date:
            filters.append(FarmProduction.production_date >= start_date)
        if end_date:
            filters.append(FarmProduction.production_date <= end_date)

        count_query = select(func.count(FarmProduction.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total = (await db.execute(count_query)).scalar() or 0

        query = (
            select(FarmProduction)
            .options(selectinload(FarmProduction.farm))
            .order_by(desc(FarmProduction.production_date), desc(FarmProduction.created_at))
            .offset(skip)
            .limit(limit)
        )
        if filters:
            query = query.where(and_(*filters))

        res = await db.execute(query)
        items = res.scalars().all()
        return items, total

    async def update_production(self, db: AsyncSession, obj: FarmProduction) -> FarmProduction:
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        query = (
            select(FarmProduction)
            .options(selectinload(FarmProduction.farm))
            .where(FarmProduction.id == obj.id)
        )
        res = await db.execute(query)
        return res.scalars().first() or obj

    async def delete_production(self, db: AsyncSession, obj: FarmProduction) -> None:
        await db.delete(obj)
        await db.commit()

    # --- Delivery Operations ---
    async def create_deliveries_batch(
        self, db: AsyncSession, deliveries: List[FarmDelivery]
    ) -> List[FarmDelivery]:
        for d in deliveries:
            db.add(d)
        await db.commit()
        ids = [d.id for d in deliveries]
        query = (
            select(FarmDelivery)
            .options(selectinload(FarmDelivery.farm))
            .where(FarmDelivery.id.in_(ids))
            .order_by(FarmDelivery.created_at)
        )
        res = await db.execute(query)
        return list(res.scalars().all())

    async def get_delivery_by_id(self, db: AsyncSession, deliv_id: str) -> Optional[FarmDelivery]:
        query = (
            select(FarmDelivery)
            .options(selectinload(FarmDelivery.farm))
            .where(FarmDelivery.id == deliv_id)
        )
        res = await db.execute(query)
        return res.scalars().first()

    async def get_deliveries(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[Sequence[FarmDelivery], int]:
        filters = []
        if farm_id:
            filters.append(FarmDelivery.farm_id == farm_id)
        if start_date:
            filters.append(FarmDelivery.delivery_date >= start_date)
        if end_date:
            filters.append(FarmDelivery.delivery_date <= end_date)

        count_query = select(func.count(FarmDelivery.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total = (await db.execute(count_query)).scalar() or 0

        query = (
            select(FarmDelivery)
            .options(selectinload(FarmDelivery.farm))
            .order_by(desc(FarmDelivery.delivery_date), desc(FarmDelivery.created_at))
            .offset(skip)
            .limit(limit)
        )
        if filters:
            query = query.where(and_(*filters))

        res = await db.execute(query)
        items = res.scalars().all()
        return items, total

    async def update_delivery(self, db: AsyncSession, obj: FarmDelivery) -> FarmDelivery:
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        query = (
            select(FarmDelivery)
            .options(selectinload(FarmDelivery.farm))
            .where(FarmDelivery.id == obj.id)
        )
        res = await db.execute(query)
        return res.scalars().first() or obj

    async def delete_delivery(self, db: AsyncSession, obj: FarmDelivery) -> None:
        await db.delete(obj)
        await db.commit()

    # --- Farm Report ---
    async def get_farm_report_data(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        # 1. Fetch Farm Entries (daily entries with production and delivery)
        entry_filters = []
        if farm_id:
            entry_filters.append(FarmEntry.farm_id == farm_id)
        if start_date:
            entry_filters.append(FarmEntry.date >= start_date)
        if end_date:
            entry_filters.append(FarmEntry.date <= end_date)

        entry_query = (
            select(FarmEntry)
            .options(selectinload(FarmEntry.deliveries), selectinload(FarmEntry.farm))
            .order_by(desc(FarmEntry.date))
        )
        if entry_filters:
            entry_query = entry_query.where(and_(*entry_filters))
        entries = (await db.execute(entry_query)).scalars().all()

        # 2. Fetch standalone FarmDeliveries (e.g. legacy ones where entry_id is NULL)
        standalone_deliv_filters = [FarmDelivery.entry_id.is_(None)]
        if farm_id:
            standalone_deliv_filters.append(FarmDelivery.farm_id == farm_id)
        if start_date:
            standalone_deliv_filters.append(FarmDelivery.delivery_date >= start_date)
        if end_date:
            standalone_deliv_filters.append(FarmDelivery.delivery_date <= end_date)

        standalone_deliv_query = select(FarmDelivery).options(selectinload(FarmDelivery.farm))
        if standalone_deliv_filters:
            standalone_deliv_query = standalone_deliv_query.where(and_(*standalone_deliv_filters))
        standalone_delivs = (await db.execute(standalone_deliv_query)).scalars().all()

        # 3. Fetch standalone FarmProductions (legacy ones)
        prod_filters = []
        if farm_id:
            prod_filters.append(FarmProduction.farm_id == farm_id)
        if start_date:
            prod_filters.append(FarmProduction.production_date >= start_date)
        if end_date:
            prod_filters.append(FarmProduction.production_date <= end_date)

        prod_query = select(FarmProduction).options(selectinload(FarmProduction.farm))
        if prod_filters:
            prod_query = prod_query.where(and_(*prod_filters))
        standalone_prods = (await db.execute(prod_query)).scalars().all()

        # Group everything by (date, farm_id)
        date_farm_groups: Dict[Tuple[date, str], Dict[str, Any]] = {}

        # Add entries
        for entry in entries:
            key = (entry.date, entry.farm_id)
            if key not in date_farm_groups:
                date_farm_groups[key] = {
                    "date": entry.date,
                    "farm_id": entry.farm_id,
                    "farm_name": entry.farm.name if entry.farm else "Unknown Farm",
                    "farm_code": entry.farm.code if entry.farm else "",
                    "production_trays": 0.0,
                    "delivery_trays": 0.0,
                    "deliveries": [],
                }
            date_farm_groups[key]["production_trays"] += float(entry.production_trays or 0.0)
            for d in entry.deliveries:
                date_farm_groups[key]["delivery_trays"] += float(d.tray_quantity)
                date_farm_groups[key]["deliveries"].append({
                    "destination": d.destination,
                    "trays": float(d.tray_quantity),
                    "notes": d.notes,
                })

        # Add standalone deliveries
        for d in standalone_delivs:
            key = (d.delivery_date, d.farm_id)
            if key not in date_farm_groups:
                date_farm_groups[key] = {
                    "date": d.delivery_date,
                    "farm_id": d.farm_id,
                    "farm_name": d.farm.name if d.farm else "Unknown Farm",
                    "farm_code": d.farm.code if d.farm else "",
                    "production_trays": 0.0,
                    "delivery_trays": 0.0,
                    "deliveries": [],
                }
            date_farm_groups[key]["delivery_trays"] += float(d.tray_quantity)
            date_farm_groups[key]["deliveries"].append({
                "destination": d.destination,
                "trays": float(d.tray_quantity),
                "notes": d.notes,
            })

        # Add standalone productions
        for p in standalone_prods:
            key = (p.production_date, p.farm_id)
            if key not in date_farm_groups:
                date_farm_groups[key] = {
                    "date": p.production_date,
                    "farm_id": p.farm_id,
                    "farm_name": p.farm.name if p.farm else "Unknown Farm",
                    "farm_code": p.farm.code if p.farm else "",
                    "production_trays": 0.0,
                    "delivery_trays": 0.0,
                    "deliveries": [],
                }
            date_farm_groups[key]["production_trays"] += float(p.tray_quantity or 0.0)

        sorted_items = sorted(date_farm_groups.values(), key=lambda x: (x["date"], x["farm_name"]), reverse=True)

        # Global KPIs:
        total_prev = 0.0
        if farm_id:
            f = await self.get_farm_by_id(db, farm_id)
            if f:
                total_prev = float(f.previous_tray or 0.0)
        else:
            farms = await self.get_all_farms(db)
            total_prev = sum(float(f.previous_tray or 0.0) for f in farms)

        filtered_prod_total = sum(item["production_trays"] for item in sorted_items)
        filtered_deliv_total = sum(item["delivery_trays"] for item in sorted_items)

        total_available = 0.0
        if farm_id:
            bal = await self.get_farm_balance(db, farm_id)
            total_available = bal["available"]
        else:
            all_bals = await self.get_all_farms_with_balances(db)
            total_available = sum(b["available_tray"] for b in all_bals)

        return {
            "kpis": {
                "total_previous_trays": total_prev,
                "total_production": filtered_prod_total,
                "total_delivered": filtered_deliv_total,
                "total_available_trays": total_available,
            },
            "items": sorted_items,
        }


farm_repository = FarmRepository()
