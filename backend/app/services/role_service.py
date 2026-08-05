from typing import Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, NotFoundException
from app.models.role import Role
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.repositories.role_repository import role_repository
from app.schemas.role import RoleCreate, RoleUpdate


class RoleService:
    async def get_all_roles(self, db: AsyncSession, current_user: User) -> Sequence[Role]:
        roles = await role_repository.get_all_with_permissions(db)
        if not current_user.role or current_user.role.code != "owner":
            roles = [r for r in roles if r.code != "owner"]

        # Populate user_count attribute dynamically
        for role in roles:
            setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return roles

    async def get_role(self, db: AsyncSession, role_id: str, current_user: User) -> Role:
        role = await role_repository.get_with_permissions(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")
        if role.code == "owner" and (not current_user.role or current_user.role.code != "owner"):
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return role

    async def create_role(self, db: AsyncSession, role_in: RoleCreate) -> Role:
        existing = await role_repository.get_by_code(db, role_in.code)
        if existing:
            raise ConflictException(f"Role code '{role_in.code}' already exists.")

        role_data = role_in.model_dump(exclude={"permission_ids"})
        role = await role_repository.create(db, obj_in=role_data)

        if role_in.permission_ids:
            permissions = await permission_repository.get_by_ids(db, role_in.permission_ids)
            await role_repository.set_role_permissions(db, role, list(permissions))

        return await role_repository.get_with_permissions(db, role.id)

    async def update_role(self, db: AsyncSession, role_id: str, role_in: RoleUpdate) -> Role:
        role = await role_repository.get_with_permissions(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        update_data = role_in.model_dump(exclude_unset=True, exclude={"permission_ids"})
        if update_data:
            role = await role_repository.update(db, db_obj=role, obj_in=update_data)

        if role_in.permission_ids is not None:
            if role.code == "owner":
                raise BadRequestException("Owner role permissions cannot be modified; Owner retains full access.")
            permissions = await permission_repository.get_by_ids(db, role_in.permission_ids)
            role = await role_repository.set_role_permissions(db, role, list(permissions))

        setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return role

    async def update_role_permissions(self, db: AsyncSession, role_id: str, permission_ids: list[str]) -> Role:
        role = await role_repository.get_with_permissions(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        if role.code == "owner":
            raise BadRequestException("Owner role permissions cannot be modified; Owner retains full access.")

        permissions = await permission_repository.get_by_ids(db, permission_ids)
        role = await role_repository.set_role_permissions(db, role, list(permissions))
        setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return role


role_service = RoleService()
