import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from app.core.logging import logger


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that assigns a unique correlation ID to every incoming request,
    measures execution duration, and logs request/response metadata.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        logger.info(f"[{request_id}] START {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            process_time = (time.perf_counter() - start_time) * 1000  # ms
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

            logger.info(
                f"[{request_id}] COMPLETED {request.method} {request.url.path} "
                f"Status: {response.status_code} in {process_time:.2f}ms"
            )
            return response
        except Exception as exc:
            process_time = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[{request_id}] FAILED {request.method} {request.url.path} "
                f"Error: {str(exc)} in {process_time:.2f}ms"
            )
            raise
