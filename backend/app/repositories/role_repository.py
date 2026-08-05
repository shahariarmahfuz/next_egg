from typing import Optional, Sequence
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.permission import Permission
from app.models.role import Role, role_permissions
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role, dict, dict]):
    def __init__(self):
        super().__init__(Role)

    async def get_by_code(self, db: AsyncSession, code: str) -> Optional[Role]:
        query = (
            select(Role)
            .where(Role.code == code)
            .options(selectinload(Role.permissions))
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_all_with_permissions(self, db: AsyncSession) -> Sequence[Role]:
        query = select(Role).options(selectinload(Role.permissions)).order_by(Role.name.asc())
        result = await db.execute(query)
        return result.scalars().all()

    async def set_role_permissions(self, db: AsyncSession, role: Role, permissions: list[Permission]) -> Role:
        """Assign permissions to a role in the role_permissions association table."""
        # Clear existing permissions
        await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role.id))
        
        # Insert new associations
        for perm in permissions:
            await db.execute(
                role_permissions.insert().values(role_id=role.id, permission_id=perm.id)
            )
        await db.flush()
        return await self.get_by_id(db, role.id) or role


role_repository = RoleRepository()
