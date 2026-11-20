"""
GROUNDSHIFT FastAPI Application Entry Point.
Multi-Mission SAR Validation and Earth Surface Change Intelligence Platform.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.core.logger import logger
from backend.app.core.memory import MemoryGovernor
from backend.app.core.errors import (
    GroundshiftException,
    groundshift_exception_handler,
    generic_exception_handler
)

from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.missions import router as missions_router
from backend.app.api.v1.study_areas import router as study_areas_router
from backend.app.api.v1.validation import router as validation_router
from backend.app.api.v1.ingestion import router as ingestion_router
from backend.app.api.v1.processing import router as processing_router
from backend.app.api.v1.validation_engine_api import router as validation_engine_router
from backend.app.api.v1.jobs import router as jobs_router
from backend.app.api.v1.overview import router as overview_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for startup and shutdown."""
    logger.info("Initializing GROUNDSHIFT Platform Foundation...")
    
    # 1. Ensure required storage directories exist
    settings.DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
    settings.DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    settings.DATA_METADATA_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Check Host Memory State
    mem = MemoryGovernor.get_system_memory()
    logger.info(
        f"Host Memory Profile: {mem['available_physical_mb']} MB available / "
        f"{mem['total_physical_mb']} MB total ({mem['physical_percent_used']}% used)."
    )
    if not mem["is_memory_safe"]:
        logger.warning("Low host memory detected at startup. Memory Governor is active.")
    else:
        logger.info("Memory headroom verified within 16 GB physical safety bounds.")

    yield
    logger.info("Shutting down GROUNDSHIFT Platform Foundation.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# ------------------------------------------------------------------------------
# CORS Middleware Configuration
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Exception Handlers
# ------------------------------------------------------------------------------
app.add_exception_handler(GroundshiftException, groundshift_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ------------------------------------------------------------------------------
# API v1 Router Registration
# ------------------------------------------------------------------------------
api_v1_prefix = "/api/v1"
app.include_router(health_router, prefix=api_v1_prefix)
app.include_router(missions_router, prefix=api_v1_prefix)
app.include_router(study_areas_router, prefix=api_v1_prefix)
app.include_router(validation_router, prefix=api_v1_prefix)
app.include_router(ingestion_router, prefix=api_v1_prefix)
app.include_router(processing_router, prefix=api_v1_prefix)
app.include_router(validation_engine_router, prefix=api_v1_prefix)
app.include_router(jobs_router, prefix=api_v1_prefix)
app.include_router(overview_router, prefix=api_v1_prefix)


@app.get("/", tags=["Root"])
async def root_endpoint():
    """Root platform discovery endpoint."""
    return JSONResponse(
        content={
            "platform": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "description": settings.PROJECT_DESCRIPTION,
            "status": "online",
            "documentation": "/docs",
            "api_v1": {
                "health": f"{api_v1_prefix}/health",
                "system": f"{api_v1_prefix}/health/system",
                "science": f"{api_v1_prefix}/health/science",
                "missions": f"{api_v1_prefix}/missions",
                "study_areas": f"{api_v1_prefix}/study-areas",
                "validation": f"{api_v1_prefix}/validation",
                "ingest": f"{api_v1_prefix}/ingest",
                "processing": f"{api_v1_prefix}/processing",
                "validation_engine": f"{api_v1_prefix}/validation-engine",
            }
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

