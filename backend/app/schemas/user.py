from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.role import RoleResponse


class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=30)
    status: str = Field("active", description="User status: active, inactive, suspended")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    role_id: str = Field(..., description="Role UUID")


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    role_id: Optional[str] = None
    status: Optional[str] = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role_id: str
    role: Optional[RoleResponse] = None
    created_at: datetime
    updated_at: datetime
