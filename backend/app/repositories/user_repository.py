from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Role
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.user import UserCreate, UserUpdate


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(User)

    async def get_by_id_with_role(self, db: AsyncSession, user_id: str) -> Optional[User]:
        query = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        query = (
            select(User)
            .where(User.username == username)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        if not email:
            return None
        query = (
            select(User)
            .where(User.email == email)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        result = await db.execute(query)
        return result.scalars().first()

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        role_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[Sequence[User], int]:
        query = select(User)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.username.ilike(pattern),
                    User.email.ilike(pattern),
                    User.phone.ilike(pattern),
                )
            )

        if role_id:
            query = query.where(User.role_id == role_id)

        if status:
            query = query.where(User.status == status)

        # Total count query
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Paginate & Order
        query = (
            query.options(selectinload(User.role).selectinload(Role.permissions))
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        users = result.scalars().all()

        return users, total


user_repository = UserRepository()
