from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    """Standardized API Response envelope."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    success: bool = True
    message: str = "Operation executed successfully"
    data: Optional[T] = None
    meta: Optional[dict[str, Any]] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardized paginated data list envelope."""
    items: List[T]
    total: int = Field(ge=0, description="Total record count")
    page: int = Field(ge=1, description="Current page number")
    size: int = Field(ge=1, description="Page size limit")
    pages: int = Field(ge=0, description="Total available pages")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponseModel(BaseModel):
    """Standardized API Error envelope."""
    success: bool = False
    error: ErrorDetail
