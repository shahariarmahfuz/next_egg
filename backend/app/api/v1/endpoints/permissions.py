from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.schemas.common import ResponseModel
from app.schemas.permission import PermissionResponse

router = APIRouter(prefix="/permissions", tags=["Roles & Permissions"])


@router.get("", response_model=ResponseModel[List[PermissionResponse]])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("role.view")),
):
    """List all available system permissions for the Role Permission Matrix Editor."""
    permissions = await permission_repository.get_all_permissions(db)
    items = [PermissionResponse.model_validate(p) for p in permissions]
    return ResponseModel[List[PermissionResponse]](
        success=True,
        message="Permissions retrieved",
        data=items,
    )
