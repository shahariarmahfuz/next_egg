from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError

from app.core.logging import logger
from app.exceptions.custom import AppException
from app.schemas.common import ErrorDetail, ErrorResponseModel


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom FastAPI exception handlers to return standard JSON responses."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        logger.error(f"AppException [{exc.code}] on {request.url}: {exc.message}", exc_info=True)
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponseModel(
                success=False,
                error=ErrorDetail(
                    code=exc.code,
                    message=exc.message,
                    details=exc.details,
                ),
            ).model_dump(),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_exception_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.error(f"Database IntegrityError on {request.url}: {exc}", exc_info=True)
        orig_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)

        msg = "Database integrity constraint violation."
        if "unique" in orig_msg.lower() or "duplicate" in orig_msg.lower():
            msg = "Record with duplicate unique field already exists."
        elif "not-null" in orig_msg.lower() or "null value" in orig_msg.lower():
            msg = "A required database field is missing."
        elif "foreignkey" in orig_msg.lower() or "fk" in orig_msg.lower():
            msg = "Referenced foreign key record does not exist."

        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponseModel(
                success=False,
                error=ErrorDetail(
                    code="INTEGRITY_ERROR",
                    message=msg,
                    details=orig_msg,
                ),
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning(f"Validation error on {request.url}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponseModel(
                success=False,
                error=ErrorDetail(
                    code="VALIDATION_ERROR",
                    message="Input validation failed",
                    details=exc.errors(),
                ),
            ).model_dump(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.warning(f"HTTPException {exc.status_code} on {request.url}: {exc.detail}")
        code = "HTTP_ERROR"
        if exc.status_code == 404:
            code = "NOT_FOUND"
        elif exc.status_code == 401:
            code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            code = "FORBIDDEN"

        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponseModel(
                success=False,
                error=ErrorDetail(
                    code=code,
                    message=str(exc.detail),
                ),
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
        err_msg = str(exc) if str(exc).strip() else "An unhandled server error occurred."
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponseModel(
                success=False,
                error=ErrorDetail(
                    code="INTERNAL_SERVER_ERROR",
                    message=err_msg,
                    details=f"{type(exc).__name__}: {err_msg}",
                ),
            ).model_dump(),
        )
