import re
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.exceptions.custom import BadRequestException
from app.models.user import User
from app.schemas.common import ResponseModel
from app.schemas.user import UserProfileUpdate, UserResponse

router = APIRouter(prefix="/profile", tags=["User Profile"])


@router.get("", response_model=ResponseModel[UserResponse])
async def get_my_profile(
    current_user: User = Depends(RequirePermission("profile.view")),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve authenticated user's profile details.
    Requires 'profile.view' permission.
    """
    return ResponseModel[UserResponse](
        success=True,
        message="Profile retrieved successfully",
        data=UserResponse.model_validate(current_user),
    )


@router.put("", response_model=ResponseModel[UserResponse])
async def update_my_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(RequirePermission("profile.edit")),
    db: AsyncSession = Depends(get_db),
):
    """
    Update authenticated user's profile information (name, profile_logo_url).
    Requires 'profile.edit' permission.
    Strictly URL-only image validation; no upload capability.
    """
    if profile_in.full_name is not None:
        trimmed_name = profile_in.full_name.strip()
        if len(trimmed_name) < 2:
            raise BadRequestException("Full name must contain at least 2 characters.")
        current_user.full_name = trimmed_name

    if profile_in.profile_logo_url is not None:
        url = profile_in.profile_logo_url.strip()
        if url == "":
            current_user.profile_logo_url = None
        else:
            if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", url, re.IGNORECASE):
                raise BadRequestException("Profile Logo URL must be a valid HTTP or HTTPS URL.")
            current_user.profile_logo_url = url

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return ResponseModel[UserResponse](
        success=True,
        message="Profile updated successfully",
        data=UserResponse.model_validate(current_user),
    )
