from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import logger
from app.models import Base
from app.db.seed import seed_initial_data
from app.db.session import AsyncSessionLocal, engine
from app.exceptions.handlers import register_exception_handlers
from app.middlewares.logging_middleware import LoggingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager handling application startup, db table creation, initial data seeding, and shutdown.
    """
    logger.info(f"Starting {settings.APP_NAME} in [{settings.APP_ENV}] mode...")

    # Ensure tables exist safely
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.warning(f"Database table verification notice: {e}")

    # Seed initial roles, permissions, and owner user
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)

    yield

    logger.info("Shutting down application server... Closing database connections.")
    await engine.dispose()


def create_app() -> FastAPI:
    """
    Application Factory constructing the FastAPI app instance with full middleware stack,
    routing, exception handlers, and configuration.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        description="Production-grade Business Management System Backend REST API",
        version="1.0.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
        docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
        redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Global Middlewares
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Exception Handlers
    register_exception_handlers(app)

    # Register API V1 Router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["System"])
    async def root_health():
        """Root health ping for reverse proxies / Docker healthchecks."""
        return {"status": "ok", "service": settings.APP_NAME}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
