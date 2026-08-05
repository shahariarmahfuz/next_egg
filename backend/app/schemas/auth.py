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


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None
