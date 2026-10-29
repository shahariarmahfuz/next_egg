"""
READ-ONLY diagnostic: finds sales whose sale_date was shifted to the previous day by the
old frontend timezone bug.

Bug signature:
  - sale_date is exactly 00:00:00 UTC (old form sent `new Date("YYYY-MM-DD").toISOString()`)
  - created_at (real insert time) in Asia/Dhaka is a DIFFERENT calendar day than sale_date in Asia/Dhaka
    (typically entries made between 00:00 and 05:59 Dhaka time)

Nothing is modified. Review the output, then fix manually or with a reviewed UPDATE.

Usage (from backend/):
    python -m scripts.find_shifted_sales
"""
import asyncio
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.sale import Sale

TZ = ZoneInfo("Asia/Dhaka")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Sale).order_by(Sale.created_at.asc()))).scalars().all()

    suspects = []
    for s in rows:
        sd = s.sale_date
        if sd is None or s.created_at is None:
            continue
        if (sd.hour, sd.minute, sd.second, sd.microsecond) != (0, 0, 0, 0):
            continue
        sale_day = sd.astimezone(TZ).date()
        created_local = s.created_at.astimezone(TZ)
        if created_local.date() != sale_day:
            suspects.append((s, sale_day, created_local))

    print(f"Checked {len(rows)} sales, {len(suspects)} suspect(s):\n")
    print(f"{'invoice_no':<20} {'sale_date (Dhaka)':<18} {'created_at (Dhaka)':<22} id")
    for s, sale_day, created_local in suspects:
        print(f"{s.invoice_no:<20} {str(sale_day):<18} {created_local:%Y-%m-%d %H:%M:%S}    {s.id}")


if __name__ == "__main__":
    asyncio.run(main())
