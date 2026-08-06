from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import Permission
from app.repositories.base import BaseRepository


class PermissionRepository(BaseRepository[Permission, dict, dict]):
    def __init__(self):
        super().__init__(Permission)

    async def get_by_code(self, db: AsyncSession, code: str) -> Optional[Permission]:
        query = select(Permission).where(Permission.code == code)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_all_ordered(self, db: AsyncSession) -> Sequence[Permission]:
        query = select(Permission).order_by(Permission.module.asc(), Permission.code.asc())
        result = await db.execute(query)
        return result.scalars().all()

    async def get_all_permissions(self, db: AsyncSession) -> Sequence[Permission]:
        return await self.get_all_ordered(db)

    async def get_by_ids(self, db: AsyncSession, ids: list[str]) -> Sequence[Permission]:
        query = select(Permission).where(Permission.id.in_(ids))
        result = await db.execute(query)
        return result.scalars().all()


permission_repository = PermissionRepository()
