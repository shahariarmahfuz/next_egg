from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="User password")
    remember_me: bool = Field(False, description="Extend token validity for remember me")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    permissions: List[str]


class LoginResponse(BaseModel):
    recovery_required: bool = False
    recovery_verified: bool = False
    recovery_token: Optional[str] = None
    username: Optional[str] = None
    message: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    expires_in: Optional[int] = None
    user: Optional[UserResponse] = None
    permissions: Optional[List[str]] = None


class RecoveryVerifyRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username or email")
    recovery_code: str = Field(..., min_length=1, description="Owner-authorized recovery code")


class RecoveryVerifyResponse(BaseModel):
    recovery_token: str
    username: str
    message: str


class RecoveryResetPasswordRequest(BaseModel):
    recovery_token: str = Field(..., min_length=1, description="Restricted recovery session token")
    new_password: str = Field(..., min_length=6, max_length=100, description="New password")


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None
