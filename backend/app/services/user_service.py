from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.user import User
from app.repositories.role_repository import role_repository
from app.repositories.user_repository import user_repository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    async def create_user(self, db: AsyncSession, user_in: UserCreate) -> User:
        # Check username uniqueness
        existing_username = await user_repository.get_by_username(db, user_in.username)
        if existing_username:
            raise ConflictException(f"Username '{user_in.username}' is already taken.")

        # Check email uniqueness if provided
        if user_in.email:
            existing_email = await user_repository.get_by_email(db, user_in.email)
            if existing_email:
                raise ConflictException(f"Email '{user_in.email}' is already registered.")

        # Check role exists
        role = await role_repository.get_by_id(db, user_in.role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{user_in.role_id}' not found.")

        user_data = user_in.model_dump(exclude={"password"})
        user_data["password_hash"] = get_password_hash(user_in.password)

        user = await user_repository.create(db, obj_in=user_data)
        return await user_repository.get_by_id_with_role(db, user.id)

    async def update_user(self, db: AsyncSession, user_id: str, user_in: UserUpdate) -> User:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        update_data = user_in.model_dump(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            update_data["password_hash"] = get_password_hash(update_data.pop("password"))

        if "role_id" in update_data and update_data["role_id"]:
            role = await role_repository.get_by_id(db, update_data["role_id"])
            if not role:
                raise NotFoundException(f"Role with ID '{update_data['role_id']}' not found.")

        updated_user = await user_repository.update(db, db_obj=user, obj_in=update_data)
        return await user_repository.get_by_id_with_role(db, updated_user.id)

    async def get_user(self, db: AsyncSession, user_id: str) -> User:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        return user

    async def get_users_paginated(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        role_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[Sequence[User], int]:
        return await user_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, role_id=role_id, status=status
        )

    async def delete_user(self, db: AsyncSession, user_id: str) -> bool:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        if user.role and user.role.code == "owner":
            # Check if this is the only owner
            owners, total = await user_repository.get_filtered(db, role_id=user.role_id)
            if total <= 1:
                raise BadRequestException("Cannot delete the last remaining Owner account.")

        await user_repository.soft_delete(db, id=user_id)
        return True


user_service = UserService()
