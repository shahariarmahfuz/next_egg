from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_recovery_session_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    needs_rehash,
    verify_password,
    verify_recovery_code_hash,
)
from app.exceptions.custom import BadRequestException, NotFoundException, UnauthorizedException
from app.models.user import User
from app.repositories.permission_repository import permission_repository
from app.repositories.user_repository import user_repository
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RecoveryVerifyResponse,
    TokenResponse,
)
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

        # Transparent upgrade to Argon2id if using legacy bcrypt or outdated parameters
        if needs_rehash(user.password_hash):
            user.password_hash = get_password_hash(password)
            db.add(user)
            await db.commit()
            await db.refresh(user)

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

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> Tuple[LoginResponse, Optional[str]]:
        """
        Process login request.
        If user's Recovery Mode is enabled, detect recovery status after backend check,
        and require Owner-authorized recovery verification code without normal session issuance.
        Otherwise proceed with standard credential validation and token generation.
        """
        user = await user_repository.get_by_username(db, login_data.username)
        if not user and "@" in login_data.username:
            user = await user_repository.get_by_email(db, login_data.username)

        if not user:
            raise UnauthorizedException("Invalid credentials")

        if user.status != "active":
            raise UnauthorizedException(f"Account is {user.status}. Please contact system administrator.")

        # Check if Recovery Mode is active for this user
        if user.recovery_mode_enabled:
            now = datetime.now(timezone.utc)
            if user.recovery_token_expires_at and user.recovery_token_expires_at < now:
                # Expired: auto disable and clear
                user.recovery_mode_enabled = False
                user.recovery_token_hash = None
                user.recovery_token_expires_at = None
                db.add(user)
                await db.commit()
                raise UnauthorizedException("Recovery mode has expired. Please contact the System Owner.")

            # Check if user passed the recovery code directly in password field
            if user.recovery_token_hash and verify_recovery_code_hash(user.id, login_data.password, user.recovery_token_hash):
                recovery_session_token = create_recovery_session_token(subject=user.id)
                return (
                    LoginResponse(
                        recovery_required=True,
                        recovery_verified=True,
                        recovery_token=recovery_session_token,
                        username=user.username,
                        message="Recovery code verified successfully. Please set a new password.",
                    ),
                    None,
                )

            # Recovery mode is active: require Owner-authorized verification code
            return (
                LoginResponse(
                    recovery_required=True,
                    recovery_verified=False,
                    username=user.username,
                    message="Recovery Mode is active for this account. Please enter your Owner-provided recovery code.",
                ),
                None,
            )

        # Standard authentication
        if not verify_password(login_data.password, user.password_hash):
            raise UnauthorizedException("Invalid credentials")

        if needs_rehash(user.password_hash):
            user.password_hash = get_password_hash(login_data.password)
            db.add(user)
            await db.commit()
            await db.refresh(user)

        permissions = await self.get_user_permissions(db, user)

        access_delta = timedelta(days=7) if login_data.remember_me else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_delta = timedelta(days=30) if login_data.remember_me else timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        access_token = create_access_token(subject=user.id, expires_delta=access_delta)
        refresh_token = create_refresh_token(subject=user.id)

        login_response = LoginResponse(
            recovery_required=False,
            access_token=access_token,
            token_type="bearer",
            expires_in=int(access_delta.total_seconds()),
            user=UserResponse.model_validate(user),
            permissions=permissions,
        )

        return login_response, refresh_token

    async def verify_recovery_code(
        self, db: AsyncSession, username_or_email: str, recovery_code: str
    ) -> RecoveryVerifyResponse:
        """Verify Owner-authorized recovery code and issue short-lived restricted recovery session token."""
        user = await user_repository.get_by_username(db, username_or_email)
        if not user and "@" in username_or_email:
            user = await user_repository.get_by_email(db, username_or_email)

        if not user:
            raise BadRequestException("Invalid recovery credentials.")

        if not user.recovery_mode_enabled:
            raise BadRequestException("Recovery mode is not active for this account.")

        now = datetime.now(timezone.utc)
        if user.recovery_token_expires_at and user.recovery_token_expires_at < now:
            user.recovery_mode_enabled = False
            user.recovery_token_hash = None
            user.recovery_token_expires_at = None
            db.add(user)
            await db.commit()
            raise BadRequestException("Recovery token has expired. Please contact the System Owner.")

        if not user.recovery_token_hash or not verify_recovery_code_hash(user.id, recovery_code, user.recovery_token_hash):
            raise BadRequestException("Invalid recovery verification code.")

        # Valid recovery verification! Issue short-lived, restricted recovery session token
        recovery_token = create_recovery_session_token(subject=user.id, expires_delta=timedelta(minutes=15))

        return RecoveryVerifyResponse(
            recovery_token=recovery_token,
            username=user.username,
            message="Recovery code verified successfully.",
        )

    async def reset_password_with_recovery(
        self, db: AsyncSession, recovery_token: str, new_password: str
    ) -> dict:
        """
        Validate restricted recovery token, hash and store new password,
        automatically disable Recovery Mode, invalidate recovery token/session immediately,
        and do not create normal session.
        """
        try:
            payload = decode_token(recovery_token)
            if payload.get("type") != "recovery":
                raise UnauthorizedException("Invalid recovery token type.")
            user_id = payload.get("sub")
            if not user_id:
                raise UnauthorizedException("Invalid recovery token payload.")
        except UnauthorizedException:
            raise
        except Exception:
            raise UnauthorizedException("Invalid or expired recovery token.")

        user = await user_repository.get_by_id_with_role(db, user_id)
        if not user:
            raise NotFoundException("User not found.")

        if not user.recovery_mode_enabled:
            raise BadRequestException("Recovery mode is not active or has already been used.")

        now = datetime.now(timezone.utc)
        if user.recovery_token_expires_at and user.recovery_token_expires_at < now:
            user.recovery_mode_enabled = False
            user.recovery_token_hash = None
            user.recovery_token_expires_at = None
            db.add(user)
            await db.commit()
            raise BadRequestException("Recovery token has expired. Please contact the System Owner.")

        if not new_password:
            raise BadRequestException("Password cannot be empty.")

        # Hash new password securely with Argon2id
        user.password_hash = get_password_hash(new_password)

        # Invalidate recovery state immediately
        user.recovery_mode_enabled = False
        user.recovery_token_hash = None
        user.recovery_token_expires_at = None

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return {"success": True, "message": "Password reset successfully. Please sign in with your new password."}

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
