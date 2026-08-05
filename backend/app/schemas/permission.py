from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PermissionBase(BaseModel):
    code: str = Field(..., description="Unique permission code (e.g. sales.create)")
    name: str = Field(..., description="Human readable permission name")
    module: str = Field(..., description="Target module (sales, customer, product, supplier, reports, user, role)")
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
