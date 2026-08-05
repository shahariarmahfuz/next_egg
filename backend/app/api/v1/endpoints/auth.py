from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, TokenResponse
from app.schemas.common import ResponseModel
from app.schemas.user import UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=ResponseModel[TokenResponse])
async def login(
    login_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user credentials, return Access Token in payload,
    and set HTTP-Only secure refresh token cookie.
    """
    token_response, refresh_token = await auth_service.login(db, login_data)

    # Set HTTP-Only Cookie for Refresh Token
    cookie_max_age = 30 * 86400 if login_data.remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=cookie_max_age,
    )

    return ResponseModel[TokenResponse](
        success=True,
        message="Login successful",
        data=token_response,
    )


@router.post("/refresh", response_model=ResponseModel[TokenResponse])
async def refresh_token(
    refresh_data: RefreshTokenRequest = None,
    db: AsyncSession = Depends(get_db),
    response: Response = None,
):
    """Issue new access token from HTTP-only cookie or payload refresh token."""
    token_str = refresh_data.refresh_token if refresh_data and refresh_data.refresh_token else None
    token_response = await auth_service.refresh_access_token(db, token_str)

    return ResponseModel[TokenResponse](
        success=True,
        message="Token refreshed successfully",
        data=token_response,
    )


@router.post("/logout", response_model=ResponseModel[dict])
async def logout(response: Response):
    """Clear refresh token HTTP-only cookie and logout user."""
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax")
    return ResponseModel[dict](
        success=True,
        message="Logged out successfully",
        data={},
    )


@router.get("/me", response_model=ResponseModel[dict])
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch current authenticated user profile, active role, and permission list."""
    permissions = await auth_service.get_user_permissions(db, current_user)
    user_data = UserResponse.model_validate(current_user)

    return ResponseModel[dict](
        success=True,
        message="User profile retrieved",
        data={
            "user": user_data.model_dump(),
            "permissions": permissions,
        },
    )
