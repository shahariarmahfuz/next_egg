from datetime import timedelta
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.exceptions.custom import BadRequestException, UnauthorizedException
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.repositories.user_repository import user_repository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse


class AuthService:
    async def authenticate_user(self, db: AsyncSession, username_or_email: str, password: str) -> User:
        """Authenticate user against username or email with password verification."""
        user = await user_repository.get_by_username(db, username_or_email)
        if not user and "@" in username_or_email:
            user = await user_repository.get_by_email(db, username_or_email)

        if not user:
            raise UnauthorizedException("Invalid credentials")

        if not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid credentials")

        if user.status != "active":
            raise UnauthorizedException(f"Account is {user.status}. Please contact system administrator.")

        return user

    async def get_user_permissions(self, db: AsyncSession, user: User) -> List[str]:
        """
        Extract permissions for a user.
        If user is Owner, return all available permission codes.
        Otherwise return permissions assigned to their Role.
        """
        if not user.role:
            return []

        if user.role.code == "owner":
            all_permissions = await permission_repository.get_all_permissions(db)
            return [p.code for p in all_permissions]

        return [p.code for p in user.role.permissions]

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> Tuple[TokenResponse, str]:
        """
        Process login request, returning TokenResponse and refresh token string.
        Extended expiry if remember_me is True.
        """
        user = await self.authenticate_user(db, login_data.username, login_data.password)
        permissions = await self.get_user_permissions(db, user)

        # Calculate expiration
        access_delta = timedelta(days=7) if login_data.remember_me else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_delta = timedelta(days=30) if login_data.remember_me else timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        access_token = create_access_token(subject=user.id, expires_delta=access_delta)
        refresh_token = create_refresh_token(subject=user.id)

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=int(access_delta.total_seconds()),
            user=UserResponse.model_validate(user),
            permissions=permissions,
        )

        return token_response, refresh_token

    async def refresh_access_token(self, db: AsyncSession, refresh_token: str) -> TokenResponse:
        """Issue new access token from valid refresh token."""
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedException("Invalid token type")
            user_id = payload.get("sub")
        except Exception:
            raise UnauthorizedException("Invalid or expired refresh token")

        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user or user.status != "active":
            raise UnauthorizedException("User inactive or no longer exists")

        permissions = await self.get_user_permissions(db, user)
        access_token = create_access_token(subject=user.id)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
            permissions=permissions,
        )


auth_service = AuthService()
