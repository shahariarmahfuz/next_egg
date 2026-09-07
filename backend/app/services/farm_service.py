import uuid
from datetime import date
from typing import Optional, Sequence, Tuple, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, NotFoundException
from app.models.farm import Farm
from app.models.farm_entry import FarmEntry
from app.models.farm_production import FarmProduction
from app.models.farm_delivery import FarmDelivery
from app.repositories.farm_repository import farm_repository
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    PreviousTrayUpdate,
    FarmResponse,
    FarmBalanceResponse,
    FarmDailyEntryCreate,
    FarmDailyEntryUpdate,
    FarmDailyEntryResponse,
    DeliveryItemResponse,
    FarmProductionCreate,
    FarmProductionUpdate,
    FarmProductionResponse,
    FarmDeliveryCreate,
    FarmDeliveryBatchCreate,
    FarmDeliveryUpdate,
    FarmDeliveryResponse,
    FarmReportResponse,
    FarmReportKPIs,
    FarmReportItem,
    DestinationBreakdown,
)


class FarmService:
    def format_entry(self, e: FarmEntry) -> FarmDailyEntryResponse:
        deliveries = [
            DeliveryItemResponse(
                id=d.id,
                entry_id=d.entry_id,
                destination=d.destination,
                tray_quantity=d.tray_quantity,
                notes=d.notes,
            )
            for d in (e.deliveries or [])
        ]
        total_deliv = sum(d.tray_quantity for d in deliveries)
        prod = float(e.production_trays or 0.0)
        return FarmDailyEntryResponse(
            id=e.id,
            farm_id=e.farm_id,
            farm_name=e.farm.name if e.farm else None,
            farm_code=e.farm.code if e.farm else None,
            date=e.date,
            production_trays=prod,
            deliveries=deliveries,
            total_delivery_trays=total_deliv,
            net_trays=prod - total_deliv,
            notes=e.notes,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )

    def format_production(self, p: FarmProduction) -> FarmProductionResponse:
        return FarmProductionResponse(
            id=p.id,
            farm_id=p.farm_id,
            farm_name=p.farm.name if p.farm else None,
            farm_code=p.farm.code if p.farm else None,
            production_date=p.production_date,
            tray_quantity=p.tray_quantity,
            notes=p.notes,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )

    def format_delivery(self, d: FarmDelivery) -> FarmDeliveryResponse:
        return FarmDeliveryResponse(
            id=d.id,
            farm_id=d.farm_id,
            farm_name=d.farm.name if d.farm else None,
            farm_code=d.farm.code if d.farm else None,
            delivery_date=d.delivery_date,
            destination=d.destination,
            tray_quantity=d.tray_quantity,
            notes=d.notes,
            batch_id=d.batch_id,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )

    # --- Farm Operations ---
    async def create_farm(self, db: AsyncSession, obj_in: FarmCreate) -> Farm:
        name = obj_in.name.strip()
        code = obj_in.code.strip() if obj_in.code else ""

        if not code:
            prefix = "".join(c for c in name if c.isalnum()).upper()[:6] or "FARM"
            suffix = 1
            candidate = f"{prefix}-{suffix:03d}"
            while await farm_repository.get_farm_by_code(db, candidate):
                suffix += 1
                candidate = f"{prefix}-{suffix:03d}"
            code = candidate
        else:
            existing = await farm_repository.get_farm_by_code(db, code)
            if existing:
                raise BadRequestException(f"Farm with code '{code}' already exists.")

        farm = Farm(
            name=name,
            code=code,
            previous_tray=float(obj_in.previous_tray or 0.0),
            address=obj_in.address.strip() if obj_in.address else None,
            contact_number=obj_in.contact_number.strip() if obj_in.contact_number else None,
            email=obj_in.email.strip() if obj_in.email else None,
            status=obj_in.status.strip() if obj_in.status else "active",
            notes=obj_in.notes.strip() if obj_in.notes else None,
        )
        return await farm_repository.create_farm(db, farm)

    async def get_all_farms(self, db: AsyncSession, status: Optional[str] = None) -> Sequence[Farm]:
        return await farm_repository.get_all_farms(db, status=status)

    async def get_all_farms_with_balances(
        self, db: AsyncSession, status: Optional[str] = None
    ) -> List[FarmBalanceResponse]:
        raw_list = await farm_repository.get_all_farms_with_balances(db, status=status)
        return [FarmBalanceResponse(**item) for item in raw_list]

    async def get_farm_by_id(self, db: AsyncSession, farm_id: str) -> Farm:
        farm = await farm_repository.get_farm_by_id(db, farm_id)
        if not farm:
            raise NotFoundException("Farm not found")
        return farm

    async def update_farm(self, db: AsyncSession, farm_id: str, obj_in: FarmUpdate) -> Farm:
        farm = await self.get_farm_by_id(db, farm_id)
        if obj_in.name is not None:
            farm.name = obj_in.name.strip()
        if obj_in.code is not None:
            new_code = obj_in.code.strip()
            if new_code != farm.code:
                existing = await farm_repository.get_farm_by_code(db, new_code)
                if existing and existing.id != farm.id:
                    raise BadRequestException(f"Farm with code '{new_code}' already exists.")
                farm.code = new_code
        if obj_in.address is not None:
            farm.address = obj_in.address.strip() if obj_in.address else None
        if obj_in.contact_number is not None:
            farm.contact_number = obj_in.contact_number.strip() if obj_in.contact_number else None
        if obj_in.email is not None:
            farm.email = obj_in.email.strip() if obj_in.email else None
        if obj_in.status is not None:
            farm.status = obj_in.status.strip()
        if obj_in.notes is not None:
            farm.notes = obj_in.notes.strip() if obj_in.notes else None
        if obj_in.previous_tray is not None:
            farm.previous_tray = float(obj_in.previous_tray)

        return await farm_repository.update_farm(db, farm)

    async def update_previous_tray(
        self, db: AsyncSession, farm_id: str, obj_in: PreviousTrayUpdate
    ) -> FarmBalanceResponse:
        farm = await self.get_farm_by_id(db, farm_id)
        farm.previous_tray = float(obj_in.previous_tray)
        await farm_repository.update_farm(db, farm)
        bal = await farm_repository.get_farm_balance(db, farm_id)
        return FarmBalanceResponse(
            id=farm.id,
            name=farm.name,
            code=farm.code,
            address=farm.address,
            contact_number=farm.contact_number,
            email=farm.email,
            status=farm.status,
            notes=farm.notes,
            previous_tray=bal["previous_tray"],
            total_production=bal["production"],
            total_delivered=bal["delivered"],
            available_tray=bal["available"],
            created_at=farm.created_at,
            updated_at=farm.updated_at,
        )

    async def delete_farm(self, db: AsyncSession, farm_id: str) -> None:
        farm = await self.get_farm_by_id(db, farm_id)
        await farm_repository.delete_farm(db, farm)

    # --- Unified Farm Daily / Transaction Entry Operations ---
    async def create_entry(
        self, db: AsyncSession, obj_in: FarmDailyEntryCreate
    ) -> FarmDailyEntryResponse:
        farm = await farm_repository.get_farm_by_id(db, obj_in.farm_id)
        if not farm:
            raise NotFoundException(f"Farm with ID '{obj_in.farm_id}' not found.")

        prod_qty = float(obj_in.production_trays or 0.0)
        total_deliv = sum(float(d.tray_quantity) for d in obj_in.deliveries)

        bal = await farm_repository.get_farm_balance(db, obj_in.farm_id)
        current_available = bal["available"]
        projected_available = current_available + prod_qty - total_deliv

        if projected_available < 0:
            raise BadRequestException(
                f"Insufficient trays available. Farm '{farm.name}' currently has {current_available:.1f} available trays. "
                f"With +{prod_qty:.1f} production and -{total_deliv:.1f} deliveries, balance would be {projected_available:.1f} trays."
            )

        entry = FarmEntry(
            farm_id=obj_in.farm_id,
            date=obj_in.date,
            production_trays=prod_qty,
            notes=obj_in.notes.strip() if obj_in.notes else None,
        )

        deliveries = [
            FarmDelivery(
                farm_id=obj_in.farm_id,
                delivery_date=obj_in.date,
                destination=d.destination.strip(),
                tray_quantity=float(d.tray_quantity),
                notes=d.notes.strip() if d.notes else None,
                batch_id=str(uuid.uuid4()),
            )
            for d in obj_in.deliveries
        ]

        saved = await farm_repository.create_entry(db, entry, deliveries)
        return self.format_entry(saved)

    async def get_entries(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FarmDailyEntryResponse], int]:
        items, total = await farm_repository.get_entries(
            db,
            farm_id=farm_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [self.format_entry(e) for e in items], total

    async def get_entry_by_id(
        self, db: AsyncSession, entry_id: str
    ) -> FarmDailyEntryResponse:
        entry = await farm_repository.get_entry_by_id(db, entry_id)
        if not entry:
            raise NotFoundException("Farm entry not found")
        return self.format_entry(entry)

    async def update_entry(
        self, db: AsyncSession, entry_id: str, obj_in: FarmDailyEntryUpdate
    ) -> FarmDailyEntryResponse:
        entry = await farm_repository.get_entry_by_id(db, entry_id)
        if not entry:
            raise NotFoundException("Farm entry not found")

        old_prod = float(entry.production_trays or 0.0)
        old_deliv = sum(float(d.tray_quantity) for d in entry.deliveries)
        old_net = old_prod - old_deliv

        new_prod = float(obj_in.production_trays) if obj_in.production_trays is not None else old_prod

        new_deliveries = None
        if obj_in.deliveries is not None:
            new_deliv = sum(float(d.tray_quantity) for d in obj_in.deliveries)
            target_date = obj_in.date if obj_in.date is not None else entry.date
            new_deliveries = [
                FarmDelivery(
                    farm_id=entry.farm_id,
                    delivery_date=target_date,
                    destination=d.destination.strip(),
                    tray_quantity=float(d.tray_quantity),
                    notes=d.notes.strip() if d.notes else None,
                    batch_id=str(uuid.uuid4()),
                )
                for d in obj_in.deliveries
            ]
        else:
            new_deliv = old_deliv

        new_net = new_prod - new_deliv
        net_delta = new_net - old_net

        if net_delta < 0:
            bal = await farm_repository.get_farm_balance(db, entry.farm_id)
            if bal["available"] + net_delta < 0:
                raise BadRequestException(
                    f"Updating this entry would reduce farm available trays by {abs(net_delta):.1f} trays. "
                    f"Current balance is only {bal['available']:.1f} trays, resulting in a negative balance."
                )

        if obj_in.date is not None:
            entry.date = obj_in.date
        if obj_in.production_trays is not None:
            entry.production_trays = new_prod
        if obj_in.notes is not None:
            entry.notes = obj_in.notes.strip() if obj_in.notes else None

        updated = await farm_repository.update_entry(db, entry, new_deliveries)
        return self.format_entry(updated)

    async def delete_entry(self, db: AsyncSession, entry_id: str) -> None:
        entry = await farm_repository.get_entry_by_id(db, entry_id)
        if not entry:
            raise NotFoundException("Farm entry not found")

        old_prod = float(entry.production_trays or 0.0)
        old_deliv = sum(float(d.tray_quantity) for d in entry.deliveries)
        net_change = old_prod - old_deliv

        # If net_change was positive, deleting removes that positive stock
        if net_change > 0:
            bal = await farm_repository.get_farm_balance(db, entry.farm_id)
            if bal["available"] - net_change < 0:
                raise BadRequestException(
                    f"Cannot delete entry. Subsequent deliveries rely on this net stock (+{net_change:.1f} trays). "
                    f"Current balance is {bal['available']:.1f} trays."
                )

        await farm_repository.delete_entry(db, entry)

    # --- Legacy Production Operations ---
    async def create_production(
        self, db: AsyncSession, obj_in: FarmProductionCreate
    ) -> FarmProductionResponse:
        farm = await farm_repository.get_farm_by_id(db, obj_in.farm_id)
        if not farm:
            raise NotFoundException(f"Farm with ID '{obj_in.farm_id}' not found.")

        prod = FarmProduction(
            farm_id=obj_in.farm_id,
            production_date=obj_in.production_date,
            tray_quantity=float(obj_in.tray_quantity),
            notes=obj_in.notes.strip() if obj_in.notes else None,
        )
        saved = await farm_repository.create_production(db, prod)
        return self.format_production(saved)

    async def get_productions(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FarmProductionResponse], int]:
        items, total = await farm_repository.get_productions(
            db,
            farm_id=farm_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [self.format_production(p) for p in items], total

    async def get_production_by_id(
        self, db: AsyncSession, prod_id: str
    ) -> FarmProductionResponse:
        prod = await farm_repository.get_production_by_id(db, prod_id)
        if not prod:
            raise NotFoundException("Production record not found")
        return self.format_production(prod)

    async def update_production(
        self, db: AsyncSession, prod_id: str, obj_in: FarmProductionUpdate
    ) -> FarmProductionResponse:
        prod = await farm_repository.get_production_by_id(db, prod_id)
        if not prod:
            raise NotFoundException("Production record not found")

        if obj_in.farm_id is not None:
            farm = await farm_repository.get_farm_by_id(db, obj_in.farm_id)
            if not farm:
                raise NotFoundException(f"Farm with ID '{obj_in.farm_id}' not found.")
            prod.farm_id = obj_in.farm_id

        if obj_in.production_date is not None:
            prod.production_date = obj_in.production_date

        if obj_in.tray_quantity is not None:
            delta = float(obj_in.tray_quantity) - float(prod.tray_quantity)
            if delta < 0:
                bal = await farm_repository.get_farm_balance(db, prod.farm_id)
                new_available = bal["available"] + delta
                if new_available < 0:
                    raise BadRequestException(
                        f"Cannot reduce production quantity by {abs(delta):.1f} trays. "
                        f"Farm only has {bal['available']:.1f} available trays."
                    )
            prod.tray_quantity = float(obj_in.tray_quantity)

        if obj_in.notes is not None:
            prod.notes = obj_in.notes.strip() if obj_in.notes else None

        updated = await farm_repository.update_production(db, prod)
        return self.format_production(updated)

    async def delete_production(self, db: AsyncSession, prod_id: str) -> None:
        prod = await farm_repository.get_production_by_id(db, prod_id)
        if not prod:
            raise NotFoundException("Production record not found")

        bal = await farm_repository.get_farm_balance(db, prod.farm_id)
        new_available = bal["available"] - float(prod.tray_quantity)
        if new_available < 0:
            raise BadRequestException(
                f"Cannot delete production of {prod.tray_quantity:.1f} trays. "
                f"Current balance: {bal['available']:.1f} trays."
            )

        await farm_repository.delete_production(db, prod)

    # --- Delivery Operations ---
    async def create_delivery(
        self, db: AsyncSession, obj_in: FarmDeliveryCreate
    ) -> FarmDeliveryResponse:
        farm = await farm_repository.get_farm_by_id(db, obj_in.farm_id)
        if not farm:
            raise NotFoundException(f"Farm with ID '{obj_in.farm_id}' not found.")

        qty = float(obj_in.tray_quantity)
        bal = await farm_repository.get_farm_balance(db, obj_in.farm_id)
        current_available = bal["available"]

        if qty > current_available:
            raise BadRequestException(
                f"Insufficient trays available. Farm '{farm.name}' currently has {current_available:.1f} available trays, "
                f"but requested delivery is {qty:.1f} trays."
            )

        d = FarmDelivery(
            farm_id=obj_in.farm_id,
            delivery_date=obj_in.delivery_date,
            destination=obj_in.destination.strip(),
            tray_quantity=qty,
            notes=obj_in.notes.strip() if obj_in.notes else None,
        )
        saved = await farm_repository.create_delivery(db, d)
        return self.format_delivery(saved)

    async def create_deliveries_batch(
        self, db: AsyncSession, obj_in: FarmDeliveryBatchCreate
    ) -> List[FarmDeliveryResponse]:
        farm = await farm_repository.get_farm_by_id(db, obj_in.farm_id)
        if not farm:
            raise NotFoundException(f"Farm with ID '{obj_in.farm_id}' not found.")

        total_requested = sum(float(e.tray_quantity) for e in obj_in.entries)
        bal = await farm_repository.get_farm_balance(db, obj_in.farm_id)
        current_available = bal["available"]

        if total_requested > current_available:
            raise BadRequestException(
                f"Insufficient trays available. Farm '{farm.name}' currently has {current_available:.1f} available trays, "
                f"but requested delivery total is {total_requested:.1f} trays."
            )

        batch_id = str(uuid.uuid4())
        deliveries = []
        for entry in obj_in.entries:
            d = FarmDelivery(
                farm_id=obj_in.farm_id,
                delivery_date=obj_in.delivery_date,
                destination=entry.destination.strip(),
                tray_quantity=float(entry.tray_quantity),
                notes=entry.notes.strip() if entry.notes else None,
                batch_id=batch_id,
            )
            deliveries.append(d)

        saved_list = await farm_repository.create_deliveries_batch(db, deliveries)
        return [self.format_delivery(d) for d in saved_list]

    async def get_deliveries(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FarmDeliveryResponse], int]:
        items, total = await farm_repository.get_deliveries(
            db,
            farm_id=farm_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [self.format_delivery(d) for d in items], total

    async def get_delivery_by_id(
        self, db: AsyncSession, deliv_id: str
    ) -> FarmDeliveryResponse:
        deliv = await farm_repository.get_delivery_by_id(db, deliv_id)
        if not deliv:
            raise NotFoundException("Delivery record not found")
        return self.format_delivery(deliv)

    async def update_delivery(
        self, db: AsyncSession, deliv_id: str, obj_in: FarmDeliveryUpdate
    ) -> FarmDeliveryResponse:
        deliv = await farm_repository.get_delivery_by_id(db, deliv_id)
        if not deliv:
            raise NotFoundException("Delivery record not found")

        if obj_in.destination is not None:
            deliv.destination = obj_in.destination.strip()

        if obj_in.delivery_date is not None:
            deliv.delivery_date = obj_in.delivery_date

        if obj_in.tray_quantity is not None:
            delta = float(obj_in.tray_quantity) - float(deliv.tray_quantity)
            if delta > 0:
                bal = await farm_repository.get_farm_balance(db, deliv.farm_id)
                if delta > bal["available"]:
                    raise BadRequestException(
                        f"Insufficient trays available to increase delivery by {delta:.1f} trays. "
                        f"Currently available: {bal['available']:.1f} trays."
                    )
            deliv.tray_quantity = float(obj_in.tray_quantity)

        if obj_in.notes is not None:
            deliv.notes = obj_in.notes.strip() if obj_in.notes else None

        updated = await farm_repository.update_delivery(db, deliv)
        return self.format_delivery(updated)

    async def delete_delivery(self, db: AsyncSession, deliv_id: str) -> None:
        deliv = await farm_repository.get_delivery_by_id(db, deliv_id)
        if not deliv:
            raise NotFoundException("Delivery record not found")

        await farm_repository.delete_delivery(db, deliv)

    # --- Farm Report ---
    async def get_farm_report(
        self,
        db: AsyncSession,
        *,
        farm_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> FarmReportResponse:
        data = await farm_repository.get_farm_report_data(
            db,
            farm_id=farm_id,
            start_date=start_date,
            end_date=end_date,
        )
        kpis = FarmReportKPIs(**data["kpis"])
        items = [
            FarmReportItem(
                date=item["date"],
                farm_id=item["farm_id"],
                farm_name=item["farm_name"],
                farm_code=item["farm_code"],
                production_trays=item["production_trays"],
                delivery_trays=item["delivery_trays"],
                deliveries=[DestinationBreakdown(**d) for d in item["deliveries"]],
            )
            for item in data["items"]
        ]
        return FarmReportResponse(kpis=kpis, items=items)


farm_service = FarmService()
