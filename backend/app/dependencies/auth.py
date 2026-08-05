from typing import Optional
from fastapi import Depends, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.dependencies.db import get_db
from app.exceptions.custom import ForbiddenException, UnauthorizedException
from app.models.user import User
from app.repositories.user_repository import user_repository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI Dependency resolving the authenticated user from JWT Bearer header or HTTP-only cookie.
    """
    # 1. Try Bearer token from header
    token_str = token

    # 2. Fallback to HTTP-Only Cookie if header missing
    if not token_str:
        token_str = request.cookies.get("access_token")

    if not token_str:
        raise UnauthorizedException("Authentication token missing")

    try:
        payload = decode_token(token_str)
        user_id: str = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token payload")
    except Exception:
        raise UnauthorizedException("Could not validate credentials")

    user = await user_repository.get_by_id_with_role(db, user_id)
    if not user:
        raise UnauthorizedException("User not found")

    if user.status != "active":
        raise ForbiddenException(f"User account is {user.status}")

    return user
