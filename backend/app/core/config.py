from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application Settings powered by Pydantic Settings v2.
    Reads environment variables from .env file or system environment.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Core Application Configuration
    APP_NAME: str = "Business Management API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security Configuration
    SECRET_KEY: str = "super-secret-key-change-this-in-production-use-openssl-rand-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database Configuration (Neon PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://neondb_owner:npg_2j3xCmEBeNcV@ep-jolly-glade-az8f29ac-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?ssl=require"

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            # Ensure asyncpg driver scheme for SQLAlchemy async engine
            if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            # Standardize sslmode / channel_binding query params for asyncpg
            if "sslmode=require" in v:
                v = v.replace("sslmode=require", "ssl=require")
            if "&channel_binding=require" in v:
                v = v.replace("&channel_binding=require", "")
        return v

    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []

    # Security & Limits
    ALLOWED_HOSTS: List[str] = ["*"]
    RATE_LIMIT_PER_MINUTE: int = 100

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"


settings = Settings()
