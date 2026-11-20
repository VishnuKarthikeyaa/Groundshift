"""
GROUNDSHIFT Health & System Diagnostic Endpoints.
"""

from fastapi import APIRouter
import sys
import platform
import numpy as np
import scipy
import shapely
import sklearn

try:
    import rasterio
    _has_rasterio = True
except ImportError:
    rasterio = None
    _has_rasterio = False

try:
    import geopandas as gpd
    _has_gpd = True
except ImportError:
    gpd = None
    _has_gpd = False

try:
    import pyproj
    _has_pyproj = True
except ImportError:
    pyproj = None
    _has_pyproj = False

try:
    import xarray as xr
    _has_xr = True
except ImportError:
    xr = None
    _has_xr = False

try:
    import h5py
    _has_h5py = True
except ImportError:
    h5py = None
    _has_h5py = False

from backend.app.config import settings
from backend.app.core.memory import MemoryGovernor

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])

@router.get("")
async def get_basic_health():
    """Returns general service health status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }

@router.get("/system")
async def get_system_health():
    """Reports host OS, architecture, and live memory status."""
    memory_stats = MemoryGovernor.get_system_memory()
    return {
        "status": "operational",
        "os": {
            "platform": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "python": {
            "version": sys.version,
            "executable": sys.executable,
        },
        "memory": memory_stats,
    }

@router.get("/science")
async def get_scientific_environment():
    """Verifies and reports all installed scientific and geospatial library versions."""
    libs = {
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "shapely": shapely.__version__,
        "scikit_learn": sklearn.__version__,
    }
    if _has_rasterio:
        libs["rasterio"] = rasterio.__version__
        libs["gdal"] = getattr(rasterio, "__gdal_version__", "unknown")
    else:
        libs["rasterio"] = "not_installed"
        libs["gdal"] = "not_installed"
    if _has_pyproj:
        libs["pyproj"] = pyproj.__version__
        libs["proj_version"] = getattr(pyproj, "__proj_version__", "unknown")
    else:
        libs["pyproj"] = "not_installed"
    if _has_gpd:
        libs["geopandas"] = gpd.__version__
    else:
        libs["geopandas"] = "not_installed"
    if _has_xr:
        libs["xarray"] = xr.__version__
    else:
        libs["xarray"] = "not_installed"
    if _has_h5py:
        libs["h5py"] = h5py.__version__
    else:
        libs["h5py"] = "not_installed"

    return {
        "status": "verified",
        "libraries": libs,
        "capabilities": {
            "hdf5_support": _has_h5py,
            "cog_generation": _has_rasterio,
            "vector_decomposition": True,
            "triplet_closure_audit": True,
        }
    }


