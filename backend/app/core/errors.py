"""
GROUNDSHIFT Centralized Error Handlers and Custom Exceptions.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from backend.app.core.logger import logger

class GroundshiftException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class MemoryExhaustionError(GroundshiftException):
    def __init__(self, message: str = "Host memory pressure: Operation throttled for safety."):
        super().__init__(message=message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

class IncompatibleGeometryError(GroundshiftException):
    def __init__(self, message: str = "Incompatible Line-of-Sight geometries cannot be compared directly without vector decomposition."):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)

async def groundshift_exception_handler(request: Request, exc: GroundshiftException):
    logger.error(f"Handled error at {request.url.path}: {exc.message} (status: {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_type": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details,
            "path": request.url.path
        }
    )

async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error at {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": "InternalServerError",
            "message": "An unexpected scientific processing or system error occurred.",
            "details": {"error": str(exc)},
            "path": request.url.path
        }
    )

