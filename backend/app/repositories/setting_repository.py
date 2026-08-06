from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.setting import Setting
from app.repositories.base import BaseRepository
from app.schemas.setting import SettingCreate, SettingUpdate

class SettingRepository(BaseRepository[Setting, SettingCreate, SettingUpdate]):
    async def get_by_group(self, db: AsyncSession, group_name: str) -> List[Setting]:
        query = select(Setting).where(Setting.group_name == group_name)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_by_key(self, db: AsyncSession, key: str) -> Setting | None:
        query = select(Setting).where(Setting.key == key)
        result = await db.execute(query)
        return result.scalars().first()

setting_repository = SettingRepository(Setting)
