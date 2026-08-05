from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.permission import PermissionResponse


class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[str]] = None


class RolePermissionAssign(BaseModel):
    permission_ids: List[str] = Field(..., description="Array of permission IDs assigned to role")


class RoleResponse(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_system: bool
    permissions: List[PermissionResponse] = Field(default_factory=list)
    user_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
