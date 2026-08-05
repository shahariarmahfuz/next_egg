from typing import Any, Optional


class AppException(Exception):
    """Base application domain exception."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None):
        super().__init__(message=message, code="NOT_FOUND", status_code=404, details=details)


class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request", details: Optional[Any] = None):
        super().__init__(message=message, code="BAD_REQUEST", status_code=400, details=details)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized access", details: Optional[Any] = None):
        super().__init__(message=message, code="UNAUTHORIZED", status_code=401, details=details)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Access forbidden", details: Optional[Any] = None):
        super().__init__(message=message, code="FORBIDDEN", status_code=403, details=details)


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict", details: Optional[Any] = None):
        super().__init__(message=message, code="CONFLICT", status_code=409, details=details)


class DatabaseException(AppException):
    def __init__(self, message: str = "Database operation failed", details: Optional[Any] = None):
        super().__init__(message=message, code="DATABASE_ERROR", status_code=500, details=details)
