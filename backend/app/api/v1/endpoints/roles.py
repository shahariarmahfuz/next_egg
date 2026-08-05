from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import ResponseModel
from app.schemas.role import RoleCreate, RolePermissionAssign, RoleResponse, RoleUpdate
from app.services.role_service import role_service

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"])


@router.get("", response_model=ResponseModel[List[RoleResponse]])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.view")),
):
    """List system and custom roles with permission counts."""
    roles = await role_service.get_all_roles(db, current_user)
    items = [RoleResponse.model_validate(r) for r in roles]
    return ResponseModel[List[RoleResponse]](
        success=True,
        message="Roles retrieved",
        data=items,
    )


@router.post("", response_model=ResponseModel[RoleResponse], status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.edit")),
):
    """Create a custom role."""
    role = await role_service.create_role(db, role_in)
    return ResponseModel[RoleResponse](
        success=True,
        message="Role created successfully",
        data=RoleResponse.model_validate(role),
    )


@router.get("/{role_id}", response_model=ResponseModel[RoleResponse])
async def get_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.view")),
):
    """Get single role with permission assignments."""
    role = await role_service.get_role(db, role_id, current_user)
    return ResponseModel[RoleResponse](
        success=True,
        message="Role retrieved",
        data=RoleResponse.model_validate(role),
    )


@router.put("/{role_id}", response_model=ResponseModel[RoleResponse])
async def update_role(
    role_id: str,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.edit")),
):
    """Update role details and permissions."""
    role = await role_service.update_role(db, role_id, role_in)
    return ResponseModel[RoleResponse](
        success=True,
        message="Role updated successfully",
        data=RoleResponse.model_validate(role),
    )


@router.put("/{role_id}/permissions", response_model=ResponseModel[RoleResponse])
async def update_role_permissions(
    role_id: str,
    permission_in: RolePermissionAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.edit")),
):
    """Role Permission Matrix Editor: Update assigned permission IDs for a role."""
    role = await role_service.update_role_permissions(db, role_id, permission_in.permission_ids)
    return ResponseModel[RoleResponse](
        success=True,
        message="Role permissions updated successfully",
        data=RoleResponse.model_validate(role),
    )
