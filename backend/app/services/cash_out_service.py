from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cash_out import CashOut
from app.models.user import User
from app.schemas.cash_out import CashOutCreate, CashOutResponse, CashOutUpdate


class CashOutService:
    async def _generate_cash_out_no(self, db: AsyncSession) -> str:
        """Generates sequential voucher number, e.g. CO-00001"""
        query = select(CashOut.cash_out_no).order_by(CashOut.created_at.desc()).limit(1)
        res = await db.execute(query)
        last_no = res.scalar_one_or_none()
        if not last_no:
            return "CO-00001"

        try:
            numeric_part = int(last_no.replace("CO-", ""))
            return f"CO-{(numeric_part + 1):05d}"
        except ValueError:
            count_res = await db.execute(select(func.count(CashOut.id)))
            count = (count_res.scalar() or 0) + 1
            return f"CO-{count:05d}"

    async def create_cash_out(
        self, db: AsyncSession, user_id: str, data: CashOutCreate
    ) -> CashOutResponse:
        if data.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cash out amount must be greater than 0.",
            )

        if not data.reason or not data.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reason for cash out is required.",
            )

        cash_out_no = await self._generate_cash_out_no(db)

        # Ensure timezone-aware UTC datetime
        dt = data.cash_out_date
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        cash_out = CashOut(
            cash_out_no=cash_out_no,
            amount=data.amount,
            cash_out_date=dt,
            reason=data.reason.strip(),
            notes=data.notes.strip() if data.notes else None,
            created_by_id=user_id,
        )
        db.add(cash_out)
        await db.commit()
        await db.refresh(cash_out)

        # Fetch with user
        user_res = await db.execute(select(User.full_name).where(User.id == user_id))
        user_name = user_res.scalar_one_or_none()

        return CashOutResponse(
            id=cash_out.id,
            cash_out_no=cash_out.cash_out_no,
            amount=cash_out.amount,
            cash_out_date=cash_out.cash_out_date,
            reason=cash_out.reason,
            notes=cash_out.notes,
            note=cash_out.notes,
            created_by_id=cash_out.created_by_id,
            created_by_name=user_name,
            created_at=cash_out.created_at,
            updated_at=cash_out.updated_at,
        )

    async def get_cash_outs(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[CashOutResponse], int]:
        query = select(CashOut).options(selectinload(CashOut.created_by))
        count_query = select(func.count(CashOut.id))

        if start_date:
            query = query.where(CashOut.cash_out_date >= start_date)
            count_query = count_query.where(CashOut.cash_out_date >= start_date)
        if end_date:
            query = query.where(CashOut.cash_out_date <= end_date)
            count_query = count_query.where(CashOut.cash_out_date <= end_date)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                (CashOut.reason.ilike(pattern))
                | (CashOut.cash_out_no.ilike(pattern))
                | (CashOut.notes.ilike(pattern))
            )
            count_query = count_query.where(
                (CashOut.reason.ilike(pattern))
                | (CashOut.cash_out_no.ilike(pattern))
                | (CashOut.notes.ilike(pattern))
            )

        query = query.order_by(CashOut.cash_out_date.desc(), CashOut.created_at.desc()).offset(skip).limit(limit)

        total = (await db.execute(count_query)).scalar() or 0
        records = (await db.execute(query)).scalars().all()

        items = [
            CashOutResponse(
                id=r.id,
                cash_out_no=r.cash_out_no,
                amount=r.amount,
                cash_out_date=r.cash_out_date,
                reason=r.reason,
                notes=r.notes,
                note=r.notes,
                created_by_id=r.created_by_id,
                created_by_name=r.created_by.full_name if r.created_by else None,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in records
        ]
        return items, total

    async def get_cash_out(self, db: AsyncSession, cash_out_id: str) -> CashOutResponse:
        result = await db.execute(
            select(CashOut).options(selectinload(CashOut.created_by)).where(CashOut.id == cash_out_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash out voucher not found.",
            )
        return CashOutResponse(
            id=record.id,
            cash_out_no=record.cash_out_no,
            amount=record.amount,
            cash_out_date=record.cash_out_date,
            reason=record.reason,
            notes=record.notes,
            note=record.notes,
            created_by_id=record.created_by_id,
            created_by_name=record.created_by.full_name if record.created_by else None,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    async def update_cash_out(
        self, db: AsyncSession, cash_out_id: str, data: CashOutUpdate
    ) -> CashOutResponse:
        result = await db.execute(
            select(CashOut).options(selectinload(CashOut.created_by)).where(CashOut.id == cash_out_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash out voucher not found.",
            )

        if data.amount is not None:
            if data.amount <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cash out amount must be greater than 0.",
                )
            record.amount = data.amount

        if data.cash_out_date is not None:
            dt = data.cash_out_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            record.cash_out_date = dt

        if data.reason is not None:
            if not data.reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reason for cash out cannot be empty.",
                )
            record.reason = data.reason.strip()

        if data.notes is not None:
            record.notes = data.notes.strip() if data.notes.strip() else None

        record.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(record)

        return CashOutResponse(
            id=record.id,
            cash_out_no=record.cash_out_no,
            amount=record.amount,
            cash_out_date=record.cash_out_date,
            reason=record.reason,
            notes=record.notes,
            note=record.notes,
            created_by_id=record.created_by_id,
            created_by_name=record.created_by.full_name if record.created_by else None,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    async def delete_cash_out(self, db: AsyncSession, cash_out_id: str) -> None:
        result = await db.execute(select(CashOut).where(CashOut.id == cash_out_id))
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash out voucher not found.",
            )
        await db.delete(record)
        await db.commit()


cash_out_service = CashOutService()
