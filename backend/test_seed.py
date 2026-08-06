import asyncio
from app.db.session import AsyncSessionLocal
from app.db.seed import seed_initial_data

async def main():
    async with AsyncSessionLocal() as db:
        await seed_initial_data(db)

asyncio.run(main())
