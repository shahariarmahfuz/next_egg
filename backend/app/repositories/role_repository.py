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
        """Assign permissions to a role using ORM relationship assignment for complete idempotency."""
        unique_perms_dict = {p.id: p for p in permissions}
        role.permissions = list(unique_perms_dict.values())
        await db.flush()
        return role

    async def get_user_count_by_role(self, db: AsyncSession, role_id: str) -> int:
        from app.models.user import User
        from sqlalchemy import func
        query = select(func.count(User.id)).where(User.role_id == role_id)
        res = await db.execute(query)
        return res.scalar() or 0


role_repository = RoleRepository()
