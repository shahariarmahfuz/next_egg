from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.exceptions.custom import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.user import User
from app.repositories.role_repository import role_repository
from app.repositories.user_repository import user_repository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    async def create_user(self, db: AsyncSession, user_in: UserCreate, current_user: User) -> User:
        # Check role exists
        role = await role_repository.get_by_id(db, user_in.role_id)
        if not role:
            raise NotFoundException("Role not found.")

        # Owner Role Protection (Owner cannot be created via UI; Admin receives 404 for Owner role)
        if role.code == "owner":
            if not current_user.role or current_user.role.code != "owner":
                raise NotFoundException("Role not found.")
            raise ForbiddenException("Cannot create an Owner account from the UI. System is restricted to 1 Owner.")

        # Admin Creation Protection ("Only Owner can create another Admin.")
        if role.code == "admin" and (not current_user.role or current_user.role.code != "owner"):
            raise ForbiddenException("Only System Owner can create Admin users.")

        # Username uniqueness
        existing_username = await user_repository.get_by_username(db, user_in.username)
        if existing_username:
            raise ConflictException(f"Username '{user_in.username}' is already taken.")

        # Email uniqueness if provided
        if user_in.email:
            existing_email = await user_repository.get_by_email(db, user_in.email)
            if existing_email:
                raise ConflictException(f"Email '{user_in.email}' is already registered.")

        user_data = user_in.model_dump(exclude={"password"})
        user_data["password_hash"] = get_password_hash(user_in.password)

        user = await user_repository.create(db, obj_in=user_data)
        return await user_repository.get_by_id_with_role(db, user.id)

    async def update_user(self, db: AsyncSession, user_id: str, user_in: UserUpdate, current_user: User) -> User:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        # If target user is Owner and caller is NOT Owner -> Return 404 Not Found (Hide Owner exists!)
        if user.role and user.role.code == "owner":
            if not current_user.role or current_user.role.code != "owner":
                raise NotFoundException(f"User with ID '{user_id}' not found.")

        update_data = user_in.model_dump(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            update_data["password_hash"] = get_password_hash(update_data.pop("password"))

        if "role_id" in update_data and update_data["role_id"]:
            new_role = await role_repository.get_by_id(db, update_data["role_id"])
            if not new_role:
                raise NotFoundException("Role not found.")

            if new_role.code == "owner":
                if not current_user.role or current_user.role.code != "owner":
                    raise NotFoundException("Role not found.")
                raise ForbiddenException("Cannot assign Owner role.")

            # Hierarchy check: "Only Owner can promote or demote Admin users."
            is_target_admin = bool(user.role and user.role.code == "admin")
            is_new_admin = bool(new_role.code == "admin")
            if (is_target_admin or is_new_admin) and user.role_id != new_role.id:
                if not current_user.role or current_user.role.code != "owner":
                    raise ForbiddenException("Only System Owner can promote or demote Admin users.")

        updated_user = await user_repository.update(db, db_obj=user, obj_in=update_data)
        return await user_repository.get_by_id_with_role(db, updated_user.id)

    async def get_user(self, db: AsyncSession, user_id: str, current_user: User) -> User:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        # If target user is Owner and caller is NOT Owner -> Return 404 Not Found
        if user.role and user.role.code == "owner" and (not current_user.role or current_user.role.code != "owner"):
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        return user

    async def get_users_paginated(
        self,
        db: AsyncSession,
        current_user: User,
        *,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        role_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[Sequence[User], int]:
        exclude_owner = bool(not current_user.role or current_user.role.code != "owner")
        return await user_repository.get_filtered(
            db, skip=skip, limit=limit, search=search, role_id=role_id, status=status, exclude_owner=exclude_owner
        )

    async def delete_user(self, db: AsyncSession, user_id: str, current_user: User) -> bool:
        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        # Target user is Owner -> If caller is NOT Owner, return 404 Not Found. If caller is Owner, block deletion!
        if user.role and user.role.code == "owner":
            if not current_user.role or current_user.role.code != "owner":
                raise NotFoundException(f"User with ID '{user_id}' not found.")
            raise BadRequestException("The System Owner account cannot be deleted.")

        # Target user is Admin -> "Only Owner can delete an Admin."
        if user.role and user.role.code == "admin" and (not current_user.role or current_user.role.code != "owner"):
            raise ForbiddenException("Only System Owner can delete an Admin user.")

        await user_repository.soft_delete(db, id=user_id)
        return True


user_service = UserService()
