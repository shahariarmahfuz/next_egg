import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user_service import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=ResponseModel[PaginatedResponse[UserResponse]])
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("user.view")),
):
    """List users with pagination, role filtering, and search capability."""
    skip = (page - 1) * size
    users, total = await user_service.get_users_paginated(
        db, skip=skip, limit=size, search=search, role_id=role_id, status=status
    )
    pages = math.ceil(total / size) if total > 0 else 0

    items = [UserResponse.model_validate(u) for u in users]
    paginated_data = PaginatedResponse[UserResponse](
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )

    return ResponseModel[PaginatedResponse[UserResponse]](
        success=True,
        message="Users retrieved",
        data=paginated_data,
    )


@router.post("", response_model=ResponseModel[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("user.create")),
):
    """Create a new user account."""
    user = await user_service.create_user(db, user_in)
    return ResponseModel[UserResponse](
        success=True,
        message="User created successfully",
        data=UserResponse.model_validate(user),
    )


@router.get("/{user_id}", response_model=ResponseModel[UserResponse])
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("user.view")),
):
    """Get single user profile by ID."""
    user = await user_service.get_user(db, user_id)
    return ResponseModel[UserResponse](
        success=True,
        message="User retrieved",
        data=UserResponse.model_validate(user),
    )


@router.put("/{user_id}", response_model=ResponseModel[UserResponse])
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("user.edit")),
):
    """Update user profile and role assignment."""
    user = await user_service.update_user(db, user_id, user_in)
    return ResponseModel[UserResponse](
        success=True,
        message="User updated successfully",
        data=UserResponse.model_validate(user),
    )


@router.delete("/{user_id}", response_model=ResponseModel[dict])
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("user.delete")),
):
    """Soft delete user account."""
    await user_service.delete_user(db, user_id)
    return ResponseModel[dict](
        success=True,
        message="User deleted successfully",
        data={"id": user_id},
    )
