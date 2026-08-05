import time
from datetime import datetime, timezone
from urllib.parse import urlparse
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.dependencies.db import get_db
from app.schemas.common import ResponseModel
from app.schemas.health import HealthCheckResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=ResponseModel[HealthCheckResponse],
    summary="Application & DB Health Status",
    description="Returns API status, database connectivity check, system environment, and server timestamp.",
)
async def check_health(db: AsyncSession = Depends(get_db)):
    """Health check endpoint evaluating service and database operational readiness."""
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error(f"Health check DB ping failed: {exc}")
        db_status = "unhealthy"

    health_data = HealthCheckResponse(
        status="ok" if db_status == "healthy" else "degraded",
        environment=settings.APP_ENV,
        version="1.0.0",
        timestamp=datetime.now(timezone.utc),
        database_status=db_status,
        services={
            "database": db_status,
            "api_v1": "operational",
        },
    )

    return ResponseModel[HealthCheckResponse](
        success=(db_status == "healthy"),
        message="Health check executed",
        data=health_data,
    )


@router.get(
    "/health/database",
    response_model=ResponseModel[dict],
    summary="Dedicated Neon PostgreSQL Database Ping",
    description="Executes a live ping query against Neon PostgreSQL database and measures round-trip query latency.",
)
async def check_database_health(db: AsyncSession = Depends(get_db)):
    """Dedicated endpoint confirming active database connection and query latency."""
    start_time = time.perf_counter()
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        latency_ms = (time.perf_counter() - start_time) * 1000

        # Parse host & database name from config without leaking passwords
        parsed = urlparse(settings.DATABASE_URL)
        db_name = parsed.path.lstrip("/")

        return ResponseModel[dict](
            success=True,
            message="Database connection verified",
            data={
                "status": "connected",
                "engine": "postgresql",
                "host": parsed.hostname,
                "database": db_name,
                "latency_ms": round(latency_ms, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception as exc:
        logger.error(f"Dedicated database health check failed: {exc}")
        return ResponseModel[dict](
            success=False,
            message=f"Database connection failed: {str(exc)}",
            data={
                "status": "disconnected",
                "engine": "postgresql",
                "error": str(exc),
            },
        )
