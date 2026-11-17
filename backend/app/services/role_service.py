from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.repositories.role_repository import role_repository
from app.schemas.role import RoleCreate, RoleUpdate

OWNER_ONLY_PERMISSION_CODES = {"customer.ledger.summary.view"}


def _is_owner(current_user: Optional[User]) -> bool:
    return bool(current_user and current_user.role and current_user.role.code == "owner")


class RoleService:
    async def _validate_and_resolve_permissions(
        self,
        db: AsyncSession,
        permission_ids: list[str],
        existing_permissions: Sequence[Permission],
        current_user: Optional[User],
    ) -> list[Permission]:
        permissions = list(await permission_repository.get_by_ids(db, permission_ids))
        if _is_owner(current_user):
            return permissions

        existing_restricted = {p.code for p in existing_permissions if p.code in OWNER_ONLY_PERMISSION_CODES}
        requested_restricted = {p.code for p in permissions if p.code in OWNER_ONLY_PERMISSION_CODES}
        if existing_restricted != requested_restricted:
            raise ForbiddenException(
                "Only Owner can grant or revoke Owner-only permissions."
            )
        return permissions
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

    async def create_role(self, db: AsyncSession, role_in: RoleCreate, current_user: Optional[User] = None) -> Role:
        existing = await role_repository.get_by_code(db, role_in.code)
        if existing:
            raise ConflictException(f"Role code '{role_in.code}' already exists.")

        permissions: list[Permission] = []
        if role_in.permission_ids:
            permissions = await self._validate_and_resolve_permissions(
                db, role_in.permission_ids, [], current_user
            )

        role_data = role_in.model_dump(exclude={"permission_ids"})
        role = await role_repository.create(db, obj_in=role_data)

        if permissions:
            await role_repository.set_role_permissions(db, role, permissions)

        return await role_repository.get_with_permissions(db, role.id)

    async def update_role(self, db: AsyncSession, role_id: str, role_in: RoleUpdate, current_user: User = None) -> Role:
        role = await role_repository.get_with_permissions(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        if role.code == "owner":
            raise BadRequestException("Owner role cannot be modified; Owner retains full access.")

        permissions: Optional[list[Permission]] = None
        if role_in.permission_ids is not None:
            permissions = await self._validate_and_resolve_permissions(
                db, role_in.permission_ids, role.permissions or [], current_user
            )

        update_data = role_in.model_dump(exclude_unset=True, exclude={"permission_ids"})
        if update_data:
            role = await role_repository.update(db, db_obj=role, obj_in=update_data)

        if permissions is not None:
            role = await role_repository.set_role_permissions(db, role, permissions)

        setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return role

    async def update_role_permissions(self, db: AsyncSession, role_id: str, permission_ids: list[str], current_user: User = None) -> Role:
        role = await role_repository.get_with_permissions(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        if role.code == "owner":
            raise BadRequestException("Owner role permissions cannot be modified; Owner retains full access.")

        permissions = await self._validate_and_resolve_permissions(
            db, permission_ids, role.permissions or [], current_user
        )
        role = await role_repository.set_role_permissions(db, role, permissions)
        setattr(role, "user_count", await role_repository.get_user_count_by_role(db, role.id))
        return role

    async def delete_role(self, db: AsyncSession, role_id: str, current_user: User = None) -> bool:
        role = await role_repository.get_by_id(db, role_id)
        if not role:
            raise NotFoundException(f"Role with ID '{role_id}' not found.")

        # Strictly block deletion of built-in system roles
        if role.is_system or (role.code and role.code.lower() in ["owner", "admin", "employee"]):
            raise BadRequestException("System roles cannot be deleted.")

        return await role_repository.delete_role(db, role)


role_service = RoleService()
