from datetime import datetime
from typing import Dict
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field("ok", description="Overall service status")
    environment: str = Field(..., description="App environment (development/production)")
    version: str = Field(..., description="App version")
    timestamp: datetime = Field(..., description="UTC server timestamp")
    database_status: str = Field("healthy", description="Database connection status")
    services: Dict[str, str] = Field(default_factory=dict, description="Dependent service statuses")
